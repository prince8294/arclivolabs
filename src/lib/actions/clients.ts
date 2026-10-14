'use server';

import { redirect } from 'next/navigation';
import { Types, type ClientSession } from 'mongoose';
import type { z } from 'zod';

import { requireRole } from '@/lib/auth/authorization';
import { hashPassword } from '@/lib/auth/password';
import {
  CLIENT_STATUS,
  CLIENT_STATUS_LABELS,
  CLIENT_SOURCES,
  CLIENT_TYPES,
  LEAD_ACTIVITY_EVENTS,
  LEAD_STATUSES,
  USER_STATUS,
} from '@/lib/constants/enums';
import connectDB from '@/lib/db/mongoose';
import { areTransactionsSupported as isTransactionCapable } from '@/lib/db/transaction';
import { generateSequentialCode } from '@/lib/db/generate-code';
import {
  clientConversionSchema,
  clientCreateSchema,
  clientStatusSchema,
  clientUpdateSchema,
  portalCreateSchema,
  portalResetSchema,
  type ClientActionState,
  type ClientConversionInput,
  type ClientCreateInput,
  type ClientUpdateInput,
  type PortalCreateInput,
  type PortalResetInput,
} from '@/lib/validations/client';
import { zodFieldErrors } from '@/lib/validations/common';
import { Client } from '@/models/Client';
import { Communication } from '@/models/Communication';
import { Lead } from '@/models/Lead';
import { User } from '@/models/User';
import { MarketingProfile } from '@/models/MarketingProfile';
import { findPossibleDuplicateClients } from '@/lib/queries/clients';
import { USER_ROLES, type AuthUser, type UserRole } from '@/types/auth';
import {
  COMMUNICATION_DIRECTIONS,
  COMMUNICATION_TYPES,
  COMMUNICATION_VISIBILITIES,
} from '@/lib/constants/enums';
import type { LeadActivityEvent } from '@/lib/constants/enums';
import { describeAssignment } from '@/lib/activities/lead-activity';

const EMAIL_TAKEN = 'An account with this email already exists.';
const GENERIC_ERROR = 'Unable to complete the request. Please try again.';

class ClientActionError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ClientActionError';
    this.field = field;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const err = error as { code?: unknown; errors?: Record<string, { code?: unknown }> };
  if (err.code === 11000 || err.code === 11001) {
    return true;
  }
  return (
    typeof err.errors === 'object' &&
    err.errors !== null &&
    Object.values(err.errors).some((e) => e?.code === 11000)
  );
}

function toState(error: unknown): ClientActionState {
  if (error instanceof ClientActionError) {
    return error.field
      ? { fieldErrors: { [error.field]: error.message } }
      : { error: error.message };
  }
  console.error('client action failed', error);
  return { error: GENERIC_ERROR };
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function fields(
  error: z.ZodError,
  names: readonly string[]
): Record<string, string> {
  return zodFieldErrors(error, names);
}

function scopeFor(user: AuthUser): { kind: 'admin' } | { kind: 'marketing'; userId: string } {
  if (user.role === USER_ROLES.ADMIN) {
    return { kind: 'admin' };
  }
  return { kind: 'marketing', userId: user.id };
}

async function createLeadConversionActivity(params: {
  leadId: Types.ObjectId | string;
  actorId: Types.ObjectId | string;
  summary: string;
  clientCode: string;
  session?: ClientSession;
}): Promise<void> {
  await Communication.create(
    [
      {
        leadId: params.leadId instanceof Types.ObjectId ? params.leadId : new Types.ObjectId(String(params.leadId)),
        type: COMMUNICATION_TYPES.SYSTEM,
        direction: COMMUNICATION_DIRECTIONS.INTERNAL,
        subject: null,
        summary: params.summary,
        notes: null,
        createdBy: params.actorId instanceof Types.ObjectId ? params.actorId : new Types.ObjectId(String(params.actorId)),
        occurredAt: new Date(),
        nextFollowUpAt: null,
        visibility: COMMUNICATION_VISIBILITIES.INTERNAL,
        event: LEAD_ACTIVITY_EVENTS.LEAD_CONVERTED,
        metadata: { clientCode: params.clientCode },
      },
    ],
    params.session ? { session: params.session } : undefined
  );
}

async function convertLeadToClientInternal(
  actor: AuthUser,
  input: ClientConversionInput,
  now = new Date()
): Promise<{ clientId: string; clientCode: string }> {
  await connectDB();

  const leadId = new Types.ObjectId(input.leadId);

  const lead = await Lead.findOne({ _id: leadId })
    .populate('assignedTo', 'name')
    .lean()
    .exec();

  if (!lead) {
    throw new ClientActionError('Lead not found.');
  }

  if (lead.status !== LEAD_STATUSES.WON) {
    throw new ClientActionError('Only leads marked Won can be converted to a client.');
  }

  if (lead.convertedClientId) {
    throw new ClientActionError('This lead has already been converted to a client.');
  }

  const existingClient = await Client.findOne({ originLeadId: leadId });
  if (existingClient) {
    throw new ClientActionError('A client record already exists for this lead.');
  }

  const assignedMarketingUserId = input.assignedMarketingUserId
    ? new Types.ObjectId(input.assignedMarketingUserId)
    : lead.assignedTo
      ? new Types.ObjectId(lead.assignedTo._id.toString())
      : null;
  // Commission attribution is a conversion-time snapshot of the Lead owner.
  // Later Client reassignment changes service ownership, not historical acquisition credit.
  const marketingAttributionUserId = lead.assignedTo
    ? new Types.ObjectId(lead.assignedTo._id.toString())
    : null;

  const supportsTransactions = await isTransactionCapable();
  let clientCode: string;

  if (supportsTransactions) {
    const db = await connectDB();
    const session = await db.startSession();
    try {
      const result = await session.withTransaction(async () => {
        clientCode = await generateSequentialCode('client', 'CLT', session);

        const [client] = await Client.create(
          [
            {
              type: input.type,
              name: input.name,
              companyName: input.companyName ?? null,
              email: input.email.toLowerCase(),
              phone: input.phone ?? null,
              alternatePhone: input.alternatePhone ?? null,
              website: input.website ?? null,
              billingAddress: input.billingAddress ?? null,
              shippingAddress: input.shippingAddress ?? null,
              taxId: input.taxId ?? null,
              notes: input.notes ?? null,
              status: CLIENT_STATUS.ACTIVE,
              source: CLIENT_SOURCES.REFERRAL,
              assignedMarketingUserId,
              marketingAttributionUserId,
              createdBy: new Types.ObjectId(actor.id),
              updatedBy: new Types.ObjectId(actor.id),
              originLeadId: leadId,
            },
          ],
          { session }
        );

        await Lead.updateOne(
          { _id: leadId },
          {
            $set: {
              convertedClientId: client._id,
              convertedAt: now,
              updatedBy: new Types.ObjectId(actor.id),
            },
          },
          { session }
        );

        await createLeadConversionActivity({
          leadId,
          actorId: actor.id,
          summary: `Lead converted to Client ${clientCode}.`,
          clientCode,
          session,
        });

        return { clientId: client._id.toString(), clientCode };
      },
      { readPreference: 'primary' }
    );
    return result;
  } finally {
    await session.endSession();
  }
  }

  clientCode = await generateSequentialCode('client', 'CLT');

  const client = await Client.create({
    type: input.type,
    name: input.name,
    companyName: input.companyName ?? null,
    email: input.email.toLowerCase(),
    phone: input.phone ?? null,
    alternatePhone: input.alternatePhone ?? null,
    website: input.website ?? null,
    billingAddress: input.billingAddress ?? null,
    shippingAddress: input.shippingAddress ?? null,
    taxId: input.taxId ?? null,
    notes: input.notes ?? null,
    status: CLIENT_STATUS.ACTIVE,
    source: CLIENT_SOURCES.REFERRAL,
    assignedMarketingUserId,
    marketingAttributionUserId,
    createdBy: new Types.ObjectId(actor.id),
    updatedBy: new Types.ObjectId(actor.id),
    originLeadId: leadId,
  });

  await Lead.updateOne(
    { _id: leadId },
    {
      $set: {
        convertedClientId: client._id,
        convertedAt: now,
        updatedBy: new Types.ObjectId(actor.id),
      },
    }
  );

  await createLeadConversionActivity({
    leadId,
    actorId: actor.id,
    summary: `Lead converted to Client ${clientCode}.`,
    clientCode,
  });

  return { clientId: client._id.toString(), clientCode };
}

/* ------------------------------------------------------------------ */
/* Lead to Client conversion                                           */
/* ------------------------------------------------------------------ */

export async function convertLeadToClient(
  _prev: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const parsed = clientConversionSchema.safeParse({
    leadId: readString(formData, 'leadId'),
    type: readString(formData, 'type'),
    name: readString(formData, 'name'),
    companyName: readString(formData, 'companyName'),
    email: readString(formData, 'email'),
    phone: readString(formData, 'phone'),
    alternatePhone: readString(formData, 'alternatePhone'),
    website: readString(formData, 'website'),
    billingAddress: {
      line1: readString(formData, 'billingLine1'),
      line2: readString(formData, 'billingLine2'),
      city: readString(formData, 'billingCity'),
      state: readString(formData, 'billingState'),
      postalCode: readString(formData, 'billingPostalCode'),
      country: readString(formData, 'billingCountry'),
    },
    shippingAddress: {
      line1: readString(formData, 'shippingLine1'),
      line2: readString(formData, 'shippingLine2'),
      city: readString(formData, 'shippingCity'),
      state: readString(formData, 'shippingState'),
      postalCode: readString(formData, 'shippingPostalCode'),
      country: readString(formData, 'shippingCountry'),
    },
    taxId: readString(formData, 'taxId'),
    assignedMarketingUserId: readString(formData, 'assignedMarketingUserId'),
    notes: readString(formData, 'notes'),
  });

  if (!parsed.success) {
    return { fieldErrors: fields(parsed.error, [
      'leadId',
      'type',
      'name',
      'companyName',
      'email',
      'phone',
      'alternatePhone',
      'website',
      'billingAddress',
      'shippingAddress',
      'taxId',
      'assignedMarketingUserId',
      'notes',
    ]) };
  }

  const input = parsed.data;

  try {
    const { clientId, clientCode } = await convertLeadToClientInternal(
      await requireRole(USER_ROLES.ADMIN),
      input
    );
    redirect(`/admin/clients/${clientId}?notice=converted`);
  } catch (error) {
    return toState(error);
  }
}

export async function getClientConversionPreview(
  leadId: string
): Promise<{
  lead: {
    id: string;
    leadCode: string;
    name: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    alternatePhone: string | null;
    website: string | null;
    source: string;
    assignedTo: { userId: string; name: string; marketingCode: string | null } | null;
    notes: string | null;
  };
  possibleDuplicates: Array<{
    id: string;
    clientCode: string;
    name: string;
    companyName: string | null;
    email: string;
    phone: string | null;
  }>;
} | null> {
  await connectDB();

  if (!Types.ObjectId.isValid(leadId)) {
    return null;
  }

  const lead = await Lead.findOne({ _id: new Types.ObjectId(leadId) })
    .populate('assignedTo', 'name')
    .lean()
    .exec();

  if (!lead) {
    return null;
  }

  let marketingCode: string | null = null;
  if (lead.assignedTo) {
    const profile = await MarketingProfile.findOne({
      userId: lead.assignedTo._id,
    })
      .select('marketingCode')
      .lean();
    marketingCode = profile?.marketingCode ?? null;
  }

  const assignee = lead.assignedTo as unknown as { _id: Types.ObjectId; name: string } | null;

  const possibleDuplicates = await findPossibleDuplicateClients(
    lead.email ?? null,
    lead.phone ?? null,
    lead.companyName ?? null
  );

  return {
    lead: {
      id: lead._id.toString(),
      leadCode: lead.leadCode,
      name: lead.name,
      companyName: lead.companyName ?? null,
      email: lead.email ?? null,
      phone: lead.phone ?? null,
      alternatePhone: lead.alternatePhone ?? null,
      website: lead.website ?? null,
      source: lead.source,
      assignedTo: assignee
        ? {
            userId: assignee._id.toString(),
            name: assignee.name,
            marketingCode,
          }
        : null,
      notes: lead.notes ?? null,
    },
    possibleDuplicates,
  };
}

/* ------------------------------------------------------------------ */
/* Manual Client creation                                              */
/* ------------------------------------------------------------------ */

export async function createClient(
  _prev: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const parsed = clientCreateSchema.safeParse({
    type: readString(formData, 'type'),
    name: readString(formData, 'name'),
    companyName: readString(formData, 'companyName'),
    email: readString(formData, 'email'),
    phone: readString(formData, 'phone'),
    alternatePhone: readString(formData, 'alternatePhone'),
    website: readString(formData, 'website'),
    billingAddress: {
      line1: readString(formData, 'billingLine1'),
      line2: readString(formData, 'billingLine2'),
      city: readString(formData, 'billingCity'),
      state: readString(formData, 'billingState'),
      postalCode: readString(formData, 'billingPostalCode'),
      country: readString(formData, 'billingCountry'),
    },
    shippingAddress: {
      line1: readString(formData, 'shippingLine1'),
      line2: readString(formData, 'shippingLine2'),
      city: readString(formData, 'shippingCity'),
      state: readString(formData, 'shippingState'),
      postalCode: readString(formData, 'shippingPostalCode'),
      country: readString(formData, 'shippingCountry'),
    },
    taxId: readString(formData, 'taxId'),
    assignedMarketingUserId: readString(formData, 'assignedMarketingUserId'),
    notes: readString(formData, 'notes'),
    source: readString(formData, 'source'),
  });

  if (!parsed.success) {
    return { fieldErrors: fields(parsed.error, [
      'type',
      'name',
      'companyName',
      'email',
      'phone',
      'alternatePhone',
      'website',
      'billingAddress',
      'shippingAddress',
      'taxId',
      'assignedMarketingUserId',
      'notes',
      'source',
    ]) };
  }

  const input = parsed.data;

  try {
    const clientCode = await generateSequentialCode('client', 'CLT');
    const actor = await requireRole(USER_ROLES.ADMIN);

    const client = await Client.create({
      type: input.type,
      name: input.name,
      companyName: input.companyName ?? null,
      email: input.email.toLowerCase(),
      phone: input.phone ?? null,
      alternatePhone: input.alternatePhone ?? null,
      website: input.website ?? null,
      billingAddress: input.billingAddress ?? null,
      shippingAddress: input.shippingAddress ?? null,
      taxId: input.taxId ?? null,
      notes: input.notes ?? null,
      status: CLIENT_STATUS.ACTIVE,
      source: input.source,
      assignedMarketingUserId: input.assignedMarketingUserId
        ? new Types.ObjectId(input.assignedMarketingUserId)
        : null,
      createdBy: new Types.ObjectId(actor.id),
      updatedBy: new Types.ObjectId(actor.id),
    });

    redirect(`/admin/clients/${client._id.toString()}?notice=created`);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { fieldErrors: { email: EMAIL_TAKEN } };
    }
    return toState(error);
  }
}

/* ------------------------------------------------------------------ */
/* Client update                                                      */
/* ------------------------------------------------------------------ */

export async function updateClient(
  _prev: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const clientId = readString(formData, 'id');

  const parsed = clientUpdateSchema.safeParse({
    type: readString(formData, 'type'),
    name: readString(formData, 'name'),
    companyName: readString(formData, 'companyName'),
    email: readString(formData, 'email'),
    phone: readString(formData, 'phone'),
    alternatePhone: readString(formData, 'alternatePhone'),
    website: readString(formData, 'website'),
    billingAddress: {
      line1: readString(formData, 'billingLine1'),
      line2: readString(formData, 'billingLine2'),
      city: readString(formData, 'billingCity'),
      state: readString(formData, 'billingState'),
      postalCode: readString(formData, 'billingPostalCode'),
      country: readString(formData, 'billingCountry'),
    },
    shippingAddress: {
      line1: readString(formData, 'shippingLine1'),
      line2: readString(formData, 'shippingLine2'),
      city: readString(formData, 'shippingCity'),
      state: readString(formData, 'shippingState'),
      postalCode: readString(formData, 'shippingPostalCode'),
      country: readString(formData, 'shippingCountry'),
    },
    taxId: readString(formData, 'taxId'),
    assignedMarketingUserId: readString(formData, 'assignedMarketingUserId'),
    notes: readString(formData, 'notes'),
    status: readString(formData, 'status'),
  });

  if (!parsed.success) {
    return { fieldErrors: fields(parsed.error, [
      'id',
      'type',
      'name',
      'companyName',
      'email',
      'phone',
      'alternatePhone',
      'website',
      'billingAddress',
      'shippingAddress',
      'taxId',
      'assignedMarketingUserId',
      'notes',
      'status',
    ]) };
  }

  const input = parsed.data;

  try {
    await connectDB();

    if (!Types.ObjectId.isValid(clientId)) {
      return { error: 'Invalid client id.' };
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return { error: 'Client not found.' };
    }

    if (input.email !== client.email) {
      const clash = await User.findOne({
        email: input.email,
        _id: { $ne: new Types.ObjectId(client.userId ?? '000000000000000000000000') },
      });
      if (clash) {
        return { fieldErrors: { email: EMAIL_TAKEN } };
      }
    }

    await Client.updateOne(
      { _id: client._id },
      {
        $set: {
          type: input.type,
          name: input.name,
          companyName: input.companyName ?? null,
          email: input.email.toLowerCase(),
          phone: input.phone ?? null,
          alternatePhone: input.alternatePhone ?? null,
          website: input.website ?? null,
          billingAddress: input.billingAddress ?? null,
          shippingAddress: input.shippingAddress ?? null,
          taxId: input.taxId ?? null,
          assignedMarketingUserId: input.assignedMarketingUserId
            ? new Types.ObjectId(input.assignedMarketingUserId)
            : null,
          notes: input.notes ?? null,
          status: input.status,
          updatedBy: new Types.ObjectId((await requireRole(USER_ROLES.ADMIN)).id),
        },
      }
    );

    redirect(`/admin/clients/${clientId}`);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { fieldErrors: { email: EMAIL_TAKEN } };
    }
    return toState(error);
  }
}

/* ------------------------------------------------------------------ */
/* Client status                                                       */
/* ------------------------------------------------------------------ */

export async function updateClientStatus(
  _prev: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const parsed = clientStatusSchema.safeParse({
    id: readString(formData, 'id'),
    status: readString(formData, 'status'),
  });

  if (!parsed.success) {
    return { error: 'Invalid request.' };
  }

  try {
    await connectDB();

    const client = await Client.findById(parsed.data.id);
    if (!client) {
      return { error: 'Client not found.' };
    }

    if (client.status === parsed.data.status) {
      return { ok: true, message: 'No changes needed.' };
    }

    await Client.updateOne(
      { _id: client._id },
      { $set: { status: parsed.data.status, updatedBy: new Types.ObjectId((await requireRole(USER_ROLES.ADMIN)).id) } }
    );

    const messages: Record<string, string> = {
      [CLIENT_STATUS.ACTIVE]: 'Client activated.',
      [CLIENT_STATUS.INACTIVE]: 'Client marked inactive.',
      [CLIENT_STATUS.BLOCKED]: 'Client blocked.',
    };

    return { ok: true, message: messages[parsed.data.status] ?? 'Status updated.' };
  } catch (error) {
    return toState(error);
  }
}

/* ------------------------------------------------------------------ */
/* Client portal access                                                */
/* ------------------------------------------------------------------ */

export async function createClientPortal(
  _prev: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const parsed = portalCreateSchema.safeParse({
    clientId: readString(formData, 'clientId'),
    loginName: readString(formData, 'loginName'),
    loginEmail: readString(formData, 'loginEmail'),
    password: readString(formData, 'password'),
    confirmPassword: readString(formData, 'confirmPassword'),
  });

  if (!parsed.success) {
    return { fieldErrors: fields(parsed.error, ['clientId', 'loginName', 'loginEmail', 'password', 'confirmPassword']) };
  }

  const input = parsed.data;

  try {
    await connectDB();

    if (!Types.ObjectId.isValid(input.clientId)) {
      return { error: 'Invalid client id.' };
    }

    const client = await Client.findById(input.clientId);
    if (!client) {
      return { error: 'Client not found.' };
    }

    if (client.userId) {
      return { error: 'Portal access is already enabled for this client.' };
    }

    const existingUser = await User.findOne({ email: input.loginEmail.toLowerCase() });
    if (existingUser) {
      return { fieldErrors: { loginEmail: EMAIL_TAKEN } };
    }

    const actor = await requireRole(USER_ROLES.ADMIN);

    const passwordHash = await hashPassword(input.password);

    const user = await User.create({
      name: input.loginName,
      email: input.loginEmail.toLowerCase(),
      role: USER_ROLES.CLIENT,
      status: USER_STATUS.ACTIVE,
      emailVerified: false,
      mustChangePassword: true,
      passwordHash,
    });

    await Client.updateOne(
      { _id: client._id },
      {
        $set: {
          userId: user._id,
          updatedBy: new Types.ObjectId(actor.id),
        },
      }
    );

    return {
      ok: true,
      message: 'Portal access created. The client must set their own password on first sign-in.',
      clientId: client._id.toString(),
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { fieldErrors: { loginEmail: EMAIL_TAKEN } };
    }
    return toState(error);
  }
}

export async function resetClientPortalPassword(
  _prev: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const parsed = portalResetSchema.safeParse({
    clientId: readString(formData, 'clientId'),
    password: readString(formData, 'password'),
    confirmPassword: readString(formData, 'confirmPassword'),
  });

  if (!parsed.success) {
    return { fieldErrors: fields(parsed.error, ['clientId', 'password', 'confirmPassword']) };
  }

  const input = parsed.data;

  try {
    await connectDB();

    if (!Types.ObjectId.isValid(input.clientId)) {
      return { error: 'Invalid client id.' };
    }

    const client = await Client.findById(input.clientId);
    if (!client || !client.userId) {
      return { error: 'Portal access is not enabled for this client.' };
    }

    const user = await User.findById(client.userId);
    if (!user || user.role !== USER_ROLES.CLIENT) {
      return { error: 'Client portal account not found.' };
    }

    const passwordHash = await hashPassword(input.password);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          mustChangePassword: true,
          status: USER_STATUS.ACTIVE,
        },
      }
    );

    return {
      ok: true,
      message: 'Password reset. The client must set their own password on next sign-in.',
    };
  } catch (error) {
    return toState(error);
  }
}

export async function suspendClientPortal(
  _prev: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const clientId = readString(formData, 'clientId');

  try {
    await connectDB();

    if (!Types.ObjectId.isValid(clientId)) {
      return { error: 'Invalid client id.' };
    }

    const client = await Client.findById(clientId);
    if (!client || !client.userId) {
      return { error: 'Portal access is not enabled for this client.' };
    }

    await User.updateOne(
      { _id: client.userId },
      { $set: { status: USER_STATUS.SUSPENDED } }
    );

    return {
      ok: true,
      message: 'Portal access suspended. The client can no longer sign in.',
    };
  } catch (error) {
    return toState(error);
  }
}

export async function reactivateClientPortal(
  _prev: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const clientId = readString(formData, 'clientId');

  try {
    await connectDB();

    if (!Types.ObjectId.isValid(clientId)) {
      return { error: 'Invalid client id.' };
    }

    const client = await Client.findById(clientId);
    if (!client || !client.userId) {
      return { error: 'Portal access is not enabled for this client.' };
    }

    if (client.status === CLIENT_STATUS.BLOCKED) {
      return { error: 'This client is blocked. Unblock the client before re-enabling portal access.' };
    }

    await User.updateOne(
      { _id: client.userId },
      { $set: { status: USER_STATUS.ACTIVE } }
    );

    return {
      ok: true,
      message: 'Portal access reactivated.',
    };
  } catch (error) {
    return toState(error);
  }
}
