import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Demo Users ──────────────────────────────────────────────────────────

  const adminPassword = await bcrypt.hash("Admin@123456", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@mindspace.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@mindspace.com",
      password: adminPassword,
      role: Role.ADMIN,
      plan: "PRO",
      avatar: "https://api.dicebear.com/8.x/initials/svg?seed=Admin",
    },
  });

  const userPassword = await bcrypt.hash("User@123456", 12);
  const regularUser = await prisma.user.upsert({
    where: { email: "user@mindspace.com" },
    update: {},
    create: {
      name: "Alex Johnson",
      email: "user@mindspace.com",
      password: userPassword,
      role: Role.USER,
      plan: "FREE",
      avatar: "https://api.dicebear.com/8.x/initials/svg?seed=Alex",
      bio: "Looking for mental wellness support and growth.",
    },
  });

  const therapistPassword = await bcrypt.hash("Therapist@123456", 12);
  const therapistUser = await prisma.user.upsert({
    where: { email: "therapist@mindspace.com" },
    update: {},
    create: {
      name: "Dr. Sarah Mitchell",
      email: "therapist@mindspace.com",
      password: therapistPassword,
      role: Role.THERAPIST,
      plan: "PRO",
      avatar: "https://api.dicebear.com/8.x/initials/svg?seed=Sarah",
      bio: "Licensed therapist specializing in anxiety and trauma.",
    },
  });

  // ── Therapist Profile ────────────────────────────────────────────────────

  await prisma.therapist.upsert({
    where: { userId: therapistUser.id },
    update: {},
    create: {
      userId: therapistUser.id,
      specialty: ["Anxiety", "Depression", "Trauma", "PTSD"],
      bio: "Dr. Sarah Mitchell is a licensed clinical psychologist with over 10 years of experience helping individuals overcome anxiety, depression, and trauma. She uses evidence-based approaches including CBT, EMDR, and mindfulness techniques.",
      approach: "I believe in a collaborative, compassionate approach to therapy. Together, we explore your experiences and build practical tools for lasting change.",
      price: 120,
      sessionTypes: ["ONLINE", "IN_PERSON"],
      languages: ["English", "Spanish"],
      experience: 10,
      rating: 4.9,
      totalReviews: 47,
      verified: true,
      available: true,
      certifications: ["Licensed Clinical Psychologist", "EMDR Certified", "CBT Specialist"],
      education: [
        { degree: "Ph.D. Clinical Psychology", institution: "Stanford University", year: 2014 },
        { degree: "B.Sc. Psychology", institution: "UCLA", year: 2010 },
      ],
      images: [
        "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400",
      ],
    },
  });

  // ── Additional Therapists ────────────────────────────────────────────────

  const therapist2 = await prisma.user.upsert({
    where: { email: "dr.james@mindspace.com" },
    update: {},
    create: {
      name: "Dr. James Okafor",
      email: "dr.james@mindspace.com",
      password: await bcrypt.hash("Therapist@123456", 12),
      role: Role.THERAPIST,
      avatar: "https://api.dicebear.com/8.x/initials/svg?seed=James",
      bio: "Cognitive behavioral therapist specializing in depression and life transitions.",
    },
  });
  await prisma.therapist.upsert({
    where: { userId: therapist2.id },
    update: {},
    create: {
      userId: therapist2.id,
      specialty: ["Depression", "Life Transitions", "Grief", "Stress Management"],
      bio: "Dr. James Okafor is a licensed therapist with 8 years of experience in CBT and solution-focused therapy, helping clients navigate depression, grief, and major life changes.",
      approach: "Practical, goal-oriented therapy grounded in empathy and evidence.",
      price: 100,
      sessionTypes: ["ONLINE"],
      languages: ["English", "French"],
      experience: 8,
      rating: 4.8,
      totalReviews: 34,
      verified: true,
      available: true,
      certifications: ["Licensed Professional Counselor", "CBT Certified"],
      education: [{ degree: "M.A. Counseling Psychology", institution: "Columbia University", year: 2016 }],
      images: ["https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400"],
    },
  });

  const therapist3 = await prisma.user.upsert({
    where: { email: "dr.priya@mindspace.com" },
    update: {},
    create: {
      name: "Dr. Priya Sharma",
      email: "dr.priya@mindspace.com",
      password: await bcrypt.hash("Therapist@123456", 12),
      role: Role.THERAPIST,
      avatar: "https://api.dicebear.com/8.x/initials/svg?seed=Priya",
    },
  });
  await prisma.therapist.upsert({
    where: { userId: therapist3.id },
    update: {},
    create: {
      userId: therapist3.id,
      specialty: ["Relationships", "Family Therapy", "Anxiety", "Self-Esteem"],
      bio: "Dr. Priya Sharma brings 12 years of experience in relationship counseling and family dynamics, helping individuals and couples build stronger, healthier connections.",
      approach: "Warm, culturally sensitive therapy that honors your unique background.",
      price: 110,
      sessionTypes: ["ONLINE", "IN_PERSON"],
      languages: ["English", "Hindi"],
      experience: 12,
      rating: 4.9,
      totalReviews: 61,
      verified: true,
      available: true,
      certifications: ["Licensed Marriage & Family Therapist", "Gottman Method Certified"],
      education: [{ degree: "Ph.D. Family Psychology", institution: "NYU", year: 2012 }],
      images: ["https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400"],
    },
  });

  const therapist4 = await prisma.user.upsert({
    where: { email: "dr.marcus@mindspace.com" },
    update: {},
    create: {
      name: "Dr. Marcus Chen",
      email: "dr.marcus@mindspace.com",
      password: await bcrypt.hash("Therapist@123456", 12),
      role: Role.THERAPIST,
      avatar: "https://api.dicebear.com/8.x/initials/svg?seed=Marcus",
    },
  });
  await prisma.therapist.upsert({
    where: { userId: therapist4.id },
    update: {},
    create: {
      userId: therapist4.id,
      specialty: ["Mindfulness", "ADHD", "Burnout", "Work-Life Balance"],
      bio: "Dr. Marcus Chen integrates mindfulness-based cognitive therapy with practical strategies to help professionals overcome burnout, ADHD challenges, and work-life imbalance.",
      approach: "Mindfulness-first, science-backed therapy for the modern professional.",
      price: 95,
      sessionTypes: ["ONLINE"],
      languages: ["English", "Mandarin"],
      experience: 7,
      rating: 4.7,
      totalReviews: 29,
      verified: true,
      available: true,
      certifications: ["MBCT Certified", "ADHD Specialist", "Licensed Psychotherapist"],
      education: [{ degree: "M.Sc. Clinical Psychology", institution: "University of Michigan", year: 2017 }],
      images: ["https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400"],
    },
  });

  // ── Mood Logs for demo user ──────────────────────────────────────────────

  const moodData = [7, 6, 8, 5, 7, 9, 6, 8, 7, 5, 6, 8, 9, 7];
  for (let i = moodData.length - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    await prisma.moodLog.create({
      data: {
        userId: regularUser.id,
        score: moodData[moodData.length - 1 - i],
        note: i % 3 === 0 ? "Feeling good today" : undefined,
        createdAt: date,
      },
    });
  }

  // ── Sample Journal ───────────────────────────────────────────────────────

  await prisma.journal.upsert({
    where: { id: "seed-journal-1" },
    update: {},
    create: {
      id: "seed-journal-1",
      userId: regularUser.id,
      content:
        "Today was a challenging day at work, but I managed to stay calm during the stressful meeting. I practiced the breathing techniques from my last session and they really helped. I'm feeling more hopeful about my progress.",
      moodScore: 7,
    },
  });

  // ── Session between user and therapist ──────────────────────────────────

  const therapistProfile = await prisma.therapist.findUnique({
    where: { userId: therapistUser.id },
  });

  if (therapistProfile) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

    await prisma.session.create({
      data: {
        userId: regularUser.id,
        therapistId: therapistProfile.id,
        date: futureDate,
        duration: 50,
        type: "ONLINE",
        status: "CONFIRMED",
        amount: 120,
      },
    });
  }

  // ── Reviews ─────────────────────────────────────────────────────────────

  const allTherapistProfiles = await prisma.therapist.findMany({ where: { verified: true } });

  const reviewPool = [
    { rating: 5, comment: "Incredibly insightful and compassionate. I felt truly heard for the first time in years. Highly recommend." },
    { rating: 5, comment: "The techniques shared have become part of my daily routine. This has been life-changing support." },
    { rating: 4, comment: "Very professional and thorough. Made me feel comfortable and safe from the very first session." },
    { rating: 5, comment: "Changed my perspective on managing anxiety completely. I now have real tools to use every day." },
    { rating: 4, comment: "Excellent listener who gives practical, actionable advice without judgment. Would absolutely recommend." },
    { rating: 5, comment: "I've tried therapy before but nothing like this. The approach is warm, evidence-based, and genuinely effective." },
    { rating: 5, comment: "After just 4 sessions I feel like a different person. My sleep, my focus, my relationships — all improved." },
    { rating: 4, comment: "Very knowledgeable and patient. Takes time to understand your specific situation before suggesting anything." },
  ];

  for (let ti = 0; ti < allTherapistProfiles.length; ti++) {
    const tp = allTherapistProfiles[ti];
    const count = 3 + (ti % 2);
    for (let ri = 0; ri < count; ri++) {
      const rv = reviewPool[(ti * 3 + ri) % reviewPool.length];
      try {
        await prisma.review.create({
          data: {
            userId: regularUser.id,
            therapistId: tp.id,
            rating: rv.rating,
            comment: rv.comment,
          },
        });
      } catch {
        // skip duplicate
      }
    }
  }

  console.log("✅ Seeding complete!");
  console.log("\n📋 Demo Accounts:");
  console.log("  Admin:     admin@mindspace.com     / Admin@123456");
  console.log("  User:      user@mindspace.com      / User@123456");
  console.log("  Therapist: therapist@mindspace.com / Therapist@123456");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
