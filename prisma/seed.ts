import { PrismaClient } from "@prisma/client";
import { Role } from "../src/lib/enums";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slugify } from "../src/lib/constants";
import { defaultWarehouseForCategories } from "../src/lib/warehouse";

type CatalogProduct = {
  sourceId: number;
  name: string;
  sku: string | null;
  description: string;
  shortDescription: string;
  regularPrice: number;
  salePrice: number | null;
  stockStatus: string;
  stockQuantity: number | null;
  maxQuantityPerOrder: number | null;
  isFeatured: boolean;
  isNewArrival: boolean;
  categories: { name: string; id: number }[];
  image: string | null;
  images: string[];
  status: string;
};

const prisma = new PrismaClient();

const STAFF = [
  {
    email: "super@invictuspharma.com",
    name: "Super User",
    role: Role.SUPERUSER,
    password: "InvictusSuper!2026",
  },
  {
    email: "admin1@invictuspharma.com",
    name: "Admin One",
    role: Role.ADMIN,
    password: "AdminOne!2026",
  },
  {
    email: "admin2@invictuspharma.com",
    name: "Admin Two",
    role: Role.ADMIN,
    password: "AdminTwo!2026",
  },
  {
    email: "admin3@invictuspharma.com",
    name: "Admin Three",
    role: Role.ADMIN,
    password: "AdminThree!2026",
  },
  {
    email: "admin4@invictuspharma.com",
    name: "Admin Four",
    role: Role.ADMIN,
    password: "AdminFour!2026",
  },
] as const;

async function main() {
  const productsPath = join(__dirname, "data", "products.json");
  const testsPath = join(__dirname, "data", "test-results.json");
  const products = JSON.parse(
    readFileSync(productsPath, "utf8"),
  ) as CatalogProduct[];
  const tests = JSON.parse(readFileSync(testsPath, "utf8")) as {
    productName: string;
    category: string;
    imagePath: string;
  }[];

  for (const account of STAFF) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        role: account.role,
        passwordHash,
      },
      create: {
        email: account.email,
        name: account.name,
        role: account.role,
        passwordHash,
      },
    });
  }

  await prisma.orderItem.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.testResult.deleteMany();

  const categoryMap = new Map<string, string>();
  const uniqueCategories = new Map<string, string>();
  for (const product of products) {
    for (const category of product.categories) {
      uniqueCategories.set(slugify(category.name), category.name);
    }
  }

  const categoryImages: Record<string, string> = {
    oils: "/images/oils.jpg",
    orals: "/images/orals.png",
    aminos: "/images/aminos.jpg",
    "peptides-glps": "/images/peptides.jpg",
    "pct-medications": "/images/pct.jpg",
    "gift-cards": "/images/gift-cards.jpg",
  };

  let sort = 1;
  for (const [slug, name] of uniqueCategories) {
    const row = await prisma.category.upsert({
      where: { slug },
      update: { name, image: categoryImages[slug] ?? null },
      create: {
        slug,
        name,
        image: categoryImages[slug] ?? null,
        sortOrder: sort,
      },
    });
    categoryMap.set(slug, row.id);
    sort += 1;
  }

  for (const product of products) {
    if (product.status && product.status !== "publish" && product.status !== "active") continue;
    const slugs = product.categories.map((c) => slugify(c.name));
    const warehouse = defaultWarehouseForCategories(slugs);
    const slug = `${slugify(product.name)}-${product.sourceId}`;
    const row = await prisma.product.upsert({
      where: { sourceId: product.sourceId },
      update: {
        name: product.name,
        sku: product.sku,
        description: product.description,
        shortDescription: product.shortDescription,
        regularPrice: product.regularPrice,
        salePrice: product.salePrice,
        image: product.image,
        stockStatus: product.stockStatus,
        stockQuantity: product.stockQuantity,
        maxQuantityPerOrder: product.maxQuantityPerOrder,
        isFeatured: product.isFeatured,
        isNewArrival: product.isNewArrival,
        warehouse,
        status: "publish",
      },
      create: {
        sourceId: product.sourceId,
        slug,
        name: product.name,
        sku: product.sku,
        description: product.description,
        shortDescription: product.shortDescription,
        regularPrice: product.regularPrice,
        salePrice: product.salePrice,
        image: product.image,
        stockStatus: product.stockStatus,
        stockQuantity: product.stockQuantity,
        maxQuantityPerOrder: product.maxQuantityPerOrder,
        isFeatured: product.isFeatured,
        isNewArrival: product.isNewArrival,
        warehouse,
        status: "publish",
      },
    });

    await prisma.productCategory.deleteMany({ where: { productId: row.id } });
    for (const slugName of slugs) {
      const categoryId = categoryMap.get(slugName);
      if (!categoryId) continue;
      await prisma.productCategory.create({
        data: { productId: row.id, categoryId },
      });
    }
  }

  await prisma.testResult.deleteMany();
  await prisma.testResult.createMany({
    data: tests.map((item, index) => ({
      productName: item.productName,
      category: item.category,
      imagePath: item.imagePath,
      sortOrder: index,
    })),
  });

  console.log(`Seeded ${STAFF.length} staff accounts and ${products.length} products.`);
  console.log("Warehouse 1 default: peptides & aminos. Warehouse 2: everything else.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
