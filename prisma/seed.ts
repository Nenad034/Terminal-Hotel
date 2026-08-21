/**
 * Terminal Hotel — Seed skripta
 * Kreira: organizacija → hotel → tipovi soba → sobe → rate grupe → rate planovi → cene (90 dana)
 *
 * Pokretanje: npm run prisma:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

async function main() {
  console.log('🌱 Seed: krenulo...');

  // ── Organizacija ────────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Boutique Hospitality Group',
    },
  });
  console.log(`  ✓ Organizacija: ${org.name} (${org.id})`);

  // ── Hotel ───────────────────────────────────────────────────────────────────
  const property = await prisma.property.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      organizationId: org.id,
      name: 'Grand Hotel Beograd',
      timezone: 'Europe/Belgrade',
      currency: 'RSD',
      address: {
        street: 'Knez Mihailova 1',
        city: 'Beograd',
        postalCode: '11000',
        country: 'RS',
      },
    },
  });
  console.log(`  ✓ Hotel: ${property.name} (${property.id})`);

  // ── Tipovi soba ─────────────────────────────────────────────────────────────
  const roomTypes = await Promise.all([
    prisma.roomType.upsert({
      where: { propertyId_code: { propertyId: property.id, code: 'STD-DBL' } },
      update: {},
      create: {
        propertyId: property.id,
        code: 'STD-DBL',
        name: 'Standard Double',
        description: 'Udobna standardna soba sa bračnim krevetom i pogledom na dvorište.',
        baseOccupancy: 2,
        maxOccupancy: 2,
        accessible: false,
        amenities: ['WiFi', 'TV', 'minibar', 'sef', 'klima'],
      },
    }),
    prisma.roomType.upsert({
      where: { propertyId_code: { propertyId: property.id, code: 'DLX-KNG' } },
      update: {},
      create: {
        propertyId: property.id,
        code: 'DLX-KNG',
        name: 'Deluxe King',
        description: 'Prostrana deluxe soba sa king bed-om i pogledom na grad.',
        baseOccupancy: 2,
        maxOccupancy: 3,
        accessible: false,
        amenities: ['WiFi', 'TV', 'minibar', 'sef', 'klima', 'kada', 'bathrobe'],
      },
    }),
    prisma.roomType.upsert({
      where: { propertyId_code: { propertyId: property.id, code: 'JNR-STE' } },
      update: {},
      create: {
        propertyId: property.id,
        code: 'JNR-STE',
        name: 'Junior Suite',
        description: 'Luksuzna junior suite sa posebnim salónom.',
        baseOccupancy: 2,
        maxOccupancy: 4,
        accessible: false,
        amenities: ['WiFi', 'TV', 'minibar', 'sef', 'klima', 'jacuzzi', 'bathrobe', 'balkon'],
      },
    }),
    prisma.roomType.upsert({
      where: { propertyId_code: { propertyId: property.id, code: 'ACC-DBL' } },
      update: {},
      create: {
        propertyId: property.id,
        code: 'ACC-DBL',
        name: 'Accessible Double',
        description: 'Pristupačna soba prilagođena osobama sa invaliditetom.',
        baseOccupancy: 2,
        maxOccupancy: 2,
        accessible: true,
        amenities: ['WiFi', 'TV', 'klima', 'prilagođeno kupatilo', 'rampa', 'šipke'],
      },
    }),
  ]);
  console.log(`  ✓ Tipovi soba: ${roomTypes.map((rt) => rt.code).join(', ')}`);

  // ── Fizičke sobe ────────────────────────────────────────────────────────────
  const roomsToCreate = [
    // Sprat 1 — Standard
    { number: '101', floor: '1', typeIdx: 0, cleanliness: 'clean' },
    { number: '102', floor: '1', typeIdx: 0, cleanliness: 'dirty' },
    { number: '103', floor: '1', typeIdx: 0, cleanliness: 'inspected' },
    { number: '104', floor: '1', typeIdx: 0, cleanliness: 'clean' },
    { number: '105', floor: '1', typeIdx: 3, cleanliness: 'clean' }, // Accessible
    // Sprat 2 — Standard + Deluxe
    { number: '201', floor: '2', typeIdx: 0, cleanliness: 'clean' },
    { number: '202', floor: '2', typeIdx: 0, cleanliness: 'clean' },
    { number: '203', floor: '2', typeIdx: 1, cleanliness: 'pickup' },
    { number: '204', floor: '2', typeIdx: 1, cleanliness: 'clean' },
    { number: '205', floor: '2', typeIdx: 1, cleanliness: 'dirty' },
    // Sprat 3 — Deluxe
    { number: '301', floor: '3', typeIdx: 1, cleanliness: 'clean' },
    { number: '302', floor: '3', typeIdx: 1, cleanliness: 'inspected' },
    { number: '303', floor: '3', typeIdx: 1, cleanliness: 'clean' },
    { number: '304', floor: '3', typeIdx: 1, cleanliness: 'clean' },
    // Sprat 4 — Junior Suite
    { number: '401', floor: '4', typeIdx: 2, cleanliness: 'clean' },
    { number: '402', floor: '4', typeIdx: 2, cleanliness: 'inspected' },
    { number: '403', floor: '4', typeIdx: 2, cleanliness: 'clean' },
    // Sprat 5 — Penthouse Junior Suite
    { number: '501', floor: '5', typeIdx: 2, cleanliness: 'clean' },
    { number: '502', floor: '5', typeIdx: 2, cleanliness: 'dirty' },
    { number: '503', floor: '5', typeIdx: 2, cleanliness: 'clean' },
  ];

  let roomsCreated = 0;
  for (const r of roomsToCreate) {
    await prisma.room.upsert({
      where: {
        propertyId_roomNumber: { propertyId: property.id, roomNumber: r.number },
      },
      update: {},
      create: {
        propertyId: property.id,
        roomNumber: r.number,
        floor: r.floor,
        roomTypeId: roomTypes[r.typeIdx].id,
        cleanlinessStatus: r.cleanliness,
      },
    });
    roomsCreated++;
  }
  console.log(`  ✓ Sobe: ${roomsCreated} soba kreirano/preskočeno`);

  // ── Rate Grupe ───────────────────────────────────────────────────────────────
  const rateGroup = await prisma.rateGroup.create({
    data: {
      propertyId: property.id,
      name: 'Standardni cenovnici',
    },
  });
  console.log(`  ✓ Rate group: ${rateGroup.name}`);

  // ── Rate Planovi ─────────────────────────────────────────────────────────────
  const [barPlan, nonRefPlan, corpPlan] = await Promise.all([
    prisma.ratePlan.upsert({
      where: { propertyId_code: { propertyId: property.id, code: 'BAR' } },
      update: {},
      create: {
        propertyId: property.id,
        rateGroupId: rateGroup.id,
        code: 'BAR',
        name: 'Best Available Rate',
        description: 'Najniža dostupna cena sa besplatnim otkazivanjem 48h pre dolaska.',
        isPublic: true,
        cancellationPolicy: { free_until_hours: 48, penalty_percent: 100 },
        minLos: 1,
        currency: 'RSD',
      },
    }),
    prisma.ratePlan.upsert({
      where: { propertyId_code: { propertyId: property.id, code: 'NRF' } },
      update: {},
      create: {
        propertyId: property.id,
        rateGroupId: rateGroup.id,
        code: 'NRF',
        name: 'Non-Refundable',
        description: 'Niža cena bez prava na povraćaj novca.',
        isPublic: true,
        cancellationPolicy: { free_until_hours: 0, penalty_percent: 100 },
        minLos: 1,
        currency: 'RSD',
      },
    }),
    prisma.ratePlan.upsert({
      where: { propertyId_code: { propertyId: property.id, code: 'CORP-LRA' } },
      update: {},
      create: {
        propertyId: property.id,
        rateGroupId: rateGroup.id,
        code: 'CORP-LRA',
        name: 'Corporate LRA',
        description: 'Korporativna cena sa Last Room Availability garancijom.',
        isPublic: false,
        cancellationPolicy: { free_until_hours: 24, penalty_percent: 0 },
        lastRoomAvailability: true,
        minLos: 1,
        currency: 'RSD',
      },
    }),
  ]);
  console.log(`  ✓ Rate planovi: BAR, NRF, CORP-LRA`);

  // ── Kalendar cena — narednih 90 dana ───────────────────────────────────────
  const basePrices: Record<string, Record<string, number>> = {
    'STD-DBL': { BAR: 11000, NRF: 9500, 'CORP-LRA': 10000 },
    'DLX-KNG': { BAR: 16000, NRF: 14000, 'CORP-LRA': 15000 },
    'JNR-STE': { BAR: 24000, NRF: 21000, 'CORP-LRA': 22000 },
    'ACC-DBL': { BAR: 11000, NRF: 9500, 'CORP-LRA': 10000 },
  };

  const planMap: Record<string, typeof barPlan> = {
    BAR: barPlan,
    NRF: nonRefPlan,
    'CORP-LRA': corpPlan,
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let ratesCreated = 0;
  for (const rt of roomTypes) {
    for (const [planCode, plan] of Object.entries(planMap)) {
      const basePrice = basePrices[rt.code]?.[planCode] ?? 10000;

      for (let d = 0; d < 90; d++) {
        const stayDate = new Date(today);
        stayDate.setDate(today.getDate() + d);

        // Sezonski multiplier: Jul/Aug/Dec = +20%
        const month = stayDate.getMonth() + 1;
        const seasonal = [7, 8, 12].includes(month) ? 1.2 : 1.0;

        // Weekend +10%
        const dayOfWeek = stayDate.getDay();
        const weekend = dayOfWeek === 5 || dayOfWeek === 6 ? 1.1 : 1.0;

        const price = Math.round(basePrice * seasonal * weekend);

        await prisma.rate.upsert({
          where: {
            ratePlanId_roomTypeId_stayDate: {
              ratePlanId: plan.id,
              roomTypeId: rt.id,
              stayDate,
            },
          },
          update: { price },
          create: {
            ratePlanId: plan.id,
            roomTypeId: rt.id,
            stayDate,
            price,
          },
        });
        ratesCreated++;
      }
    }
  }
  console.log(`  ✓ Rate kalendar: ${ratesCreated} cena upisano (4 tipova × 3 planovi × 90 dana)`);

  // ── Demo gost ────────────────────────────────────────────────────────────────
  const guest = await prisma.guestProfile.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      organizationId: org.id,
      firstName: 'Ana',
      lastName: 'Nikolić',
      email: 'ana.nikolic@example.com',
      phone: '+381641234567',
      nationality: 'RS',
      idDocumentType: 'passport',
      idDocumentNumber: 'SR1234567',
      marketingConsent: true,
      consentRecordedAt: new Date(),
      loyaltyTier: 'silver',
      preferences: { pillow: 'soft', floor: 'high', roomType: 'DLX-KNG' },
    },
  });
  console.log(`  ✓ Demo gost: ${guest.firstName} ${guest.lastName} (${guest.email})`);

  // ── Dining outlet ────────────────────────────────────────────────────────────
  const restaurant = await prisma.diningOutlet.create({
    data: {
      propertyId: property.id,
      name: 'Restoran Metropol',
      outletType: 'restaurant',
      totalSeats: 80,
    },
  });

  // Stolovi
  for (let i = 1; i <= 20; i++) {
    await prisma.diningTable.create({
      data: {
        outletId: restaurant.id,
        tableNumber: `T${String(i).padStart(2, '0')}`,
        seatCapacity: i <= 10 ? 2 : 4,
      },
    });
  }
  console.log(`  ✓ Restoran: ${restaurant.name} sa 20 stolova`);

  console.log('\n🎉 Seed završen!');
  console.log(`\nKorisni ID-jevi za testiranje:`);
  console.log(`  Property ID:         ${property.id}`);
  console.log(`  Organization ID:     ${org.id}`);
  console.log(`  Demo Guest ID:       ${guest.id}`);
  console.log(`  Standard Double RT:  ${roomTypes[0].id}`);
  console.log(`  Deluxe King RT:      ${roomTypes[1].id}`);
  console.log(`  Junior Suite RT:     ${roomTypes[2].id}`);
  console.log(`  BAR Rate Plan:       ${barPlan.id}`);
  console.log(`\n  Swagger UI: http://localhost:3000/api/docs`);
  console.log(`  x-property-id header: ${property.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
