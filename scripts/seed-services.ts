/**
 * Seed the default service catalogue.
 *
 * Usage:
 *   npm run seed:services
 *
 * CRM forms read their "Service interest" options from MongoDB (the
 * Service collection) instead of a hardcoded list, so the catalogue has
 * to exist before leads can be captured. This script is idempotent: a
 * service that already exists (matched by name) is left untouched, so
 * renaming a description or reordering never duplicates a row.
 *
 * Codes are allocated through the same atomic Counter used elsewhere
 * (EMP-/MKT-/LEAD-), so repeated runs never collide.
 */

import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

interface ServiceSeed {
  name: string;
  description: string;
  sortOrder: number;
}

const SERVICES: ServiceSeed[] = [
  {
    name: 'Website Development',
    description: 'Marketing websites, landing pages and CMS builds.',
    sortOrder: 10,
  },
  {
    name: 'Web Application Development',
    description: 'Custom web apps, portals and internal dashboards.',
    sortOrder: 20,
  },
  {
    name: 'Mobile App Development',
    description: 'Android and iOS applications.',
    sortOrder: 30,
  },
  {
    name: 'UI/UX Design',
    description: 'Research, wireframes and product interface design.',
    sortOrder: 40,
  },
  {
    name: 'Graphic Design',
    description: 'Brand identity, print and social media creatives.',
    sortOrder: 50,
  },
  {
    name: 'Video Editing',
    description: 'Corporate videos, reels and post-production.',
    sortOrder: 60,
  },
  {
    name: 'SEO',
    description: 'Technical SEO, content optimisation and local search.',
    sortOrder: 70,
  },
  {
    name: 'Digital Marketing',
    description: 'Paid campaigns, performance marketing and analytics.',
    sortOrder: 80,
  },
];

async function main(): Promise<void> {
  const { generateSequentialCode } = await import(
    '../src/lib/db/generate-code'
  );
  const { Service } = await import('../src/models/Service');
  const connectDB = (await import('../src/lib/db/mongoose')).default;

  const db = await connectDB();

  try {
    let created = 0;
    let skipped = 0;

    for (const service of SERVICES) {
      const existing = await Service.findOne({ name: service.name });
      if (existing) {
        skipped += 1;
        continue;
      }
      const serviceCode = await generateSequentialCode('service', 'SVC');
      await Service.create({
        serviceCode,
        name: service.name,
        description: service.description,
        isActive: true,
        sortOrder: service.sortOrder,
      });
      created += 1;
    }

    console.log(
      `[seed:services] Done. ${created} created, ${skipped} already present.`
    );
  } catch (error) {
    console.error(
      '[seed:services] Failed:',
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  } finally {
    await db.disconnect();
  }
}

main().catch((error) => {
  console.error('[seed:services] Unexpected failure:', error);
  process.exit(1);
});