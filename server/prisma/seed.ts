import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditEvent.deleteMany();
  await prisma.personalUseCharge.deleteMany();
  await prisma.taxiVendorInvoiceLine.deleteMany();
  await prisma.taxiVendorInvoiceBatch.deleteMany();
  await prisma.taxiBookingRequest.deleteMany();
  await prisma.employee.deleteMany();

  const carine = await prisma.employee.create({
    data: {
      name: "Carine Miremont",
      position: "Managing Director",
      department: "Executive",
      email: "carine.miremont@totalenergies.mu",
      isManCom: true,
      hasCompanyVehicle: true,
    },
  });

  const hrManager = await prisma.employee.create({
    data: {
      name: "Kammal Baboo",
      position: "HR Manager",
      department: "Human Resources",
      email: "kammal.baboo@totalenergies.mu",
      isManCom: true,
      managerId: carine.id,
      hasCompanyVehicle: true,
    },
  });

  const opsManager = await prisma.employee.create({
    data: {
      name: "Priya Ramsamy",
      position: "Operations Manager",
      department: "Operations",
      email: "priya.ramsamy@totalenergies.mu",
      managerId: carine.id,
      hasCompanyVehicle: true,
    },
  });

  await prisma.employee.create({
    data: {
      name: "Jean Marie",
      position: "Customer Service Agent",
      department: "Operations",
      email: "jean.marie@totalenergies.mu",
      managerId: opsManager.id,
      hasCompanyVehicle: false,
      hasTransportAllowance: false,
    },
  });

  await prisma.employee.create({
    data: {
      name: "Ashwina Gopal",
      position: "Accounts Clerk",
      department: "Finance",
      email: "ashwina.gopal@totalenergies.mu",
      managerId: hrManager.id,
      hasCompanyVehicle: false,
      hasTransportAllowance: false,
    },
  });

  console.log("Seeded employees.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
