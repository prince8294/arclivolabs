import { Types } from 'mongoose';
import PDFDocument from 'pdfkit';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { USER_ROLES } from '@/types/auth';
import connectDB from '@/lib/db/mongoose';
import { Client } from '@/models/Client';
import { PaymentReceipt } from '@/models/PaymentReceipt';
import type { IPaymentReceipt } from '@/models/PaymentReceipt';
import { PAYMENT_RECEIPT_STATUSES } from '@/lib/constants/enums';
import { formatMinor } from '@/lib/utils/money';

function buildReceiptPdf(receipt: IPaymentReceipt): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!receipt) return reject(new Error('Receipt not found.'));
    const doc = new PDFDocument({ size: 'A4', margin: 54, info: { Title: `Payment Receipt ${receipt.receiptCode}`, Author: 'Arclivo Labs' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(22).fillColor('#0f172a').text(receipt.sellerSnapshot.companyName);
    doc.moveDown(0.3).fontSize(10).fillColor('#64748b').text('PAYMENT RECEIPT');
    doc.moveDown(1.5).fontSize(12).fillColor('#0f172a').text(`Receipt: ${receipt.receiptCode}`).text(`Issued: ${receipt.issuedAt.toISOString().slice(0, 10)}`).text(`Client: ${receipt.customerSnapshot.clientName} (${receipt.customerSnapshot.clientCode})`).text(`Amount received: ${formatMinor(receipt.receiptAmountMinor, receipt.currency)}`).text(`Method: ${receipt.paymentMethod}`).text(`Transaction reference: ${receipt.transactionReference}`).text(`Transaction date: ${receipt.transactionDate.toISOString().slice(0, 10)}`);
    doc.moveDown().fontSize(13).text('Invoice allocation');
    for (const row of receipt.allocationSnapshot) doc.fontSize(11).text(`${row.invoiceNumber}: ${formatMinor(row.amountMinor, receipt.currency)}`);
    if (receipt.status === PAYMENT_RECEIPT_STATUSES.INVALIDATED) doc.moveDown().fillColor('#b91c1c').text(`REVERSED / INVALIDATED: ${receipt.invalidationReason ?? 'Payment was reversed.'}`);
    doc.moveDown(2).fillColor('#64748b').fontSize(9).text('This receipt acknowledges a verified payment. It is not an invoice and does not alter the original invoice terms.');
    doc.end();
  });
}

export async function GET(_request: Request, context: RouteContext<'/api/receipts/[id]/pdf'>) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params; if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 }); await connectDB();
  const receipt = await PaymentReceipt.findById(id); if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.role === USER_ROLES.CLIENT) { const client = await Client.findOne({ userId: new Types.ObjectId(user.id), _id: receipt.clientId, status: 'ACTIVE' }).lean(); if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 }); } else if (user.role !== USER_ROLES.ADMIN) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const pdf = await buildReceiptPdf(receipt); return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${receipt.receiptCode}.pdf"`, 'Cache-Control': 'private, no-store' } });
}
