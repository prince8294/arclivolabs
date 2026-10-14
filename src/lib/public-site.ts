import type { LucideIcon } from "lucide-react";
import {
  Blocks,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CloudCog,
  CodeXml,
  DatabaseZap,
  Gauge,
  HeartPulse,
  Hotel,
  Layers3,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Rocket,
  SearchCheck,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Workflow,
} from "lucide-react";

export const publicNavigation = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Work", href: "/work" },
  { label: "Solutions", href: "/solutions" },
  { label: "About", href: "/about" },
  { label: "Process", href: "/process" },
  { label: "Contact", href: "/contact" },
] as const;

export type PublicService = {
  title: string;
  summary: string;
  outcome: string;
  icon: LucideIcon;
  featured?: boolean;
};

export const services: PublicService[] = [
  {
    title: "Website design & development",
    summary: "Fast, accessible marketing websites designed to turn attention into qualified action.",
    outcome: "A polished website your team can confidently grow.",
    icon: CodeXml,
    featured: true,
  },
  {
    title: "Web applications",
    summary: "Secure, role-based platforms and operational tools shaped around real workflows.",
    outcome: "Less manual work and a clearer operating system.",
    icon: LayoutDashboard,
  },
  {
    title: "Mobile applications",
    summary: "Responsive product experiences that feel natural across phones, tablets, and the web.",
    outcome: "A consistent experience wherever customers engage.",
    icon: Blocks,
  },
  {
    title: "UI/UX design",
    summary: "Research-led flows, interface systems, and prototypes that make complex products simpler.",
    outcome: "Clearer journeys and faster product decisions.",
    icon: Layers3,
  },
  {
    title: "AI & automation",
    summary: "Practical automations, assistants, and data workflows built around measurable use cases.",
    outcome: "More capacity without adding repetitive work.",
    icon: BrainCircuit,
    featured: true,
  },
  {
    title: "Cloud & backend systems",
    summary: "Reliable APIs, databases, integrations, and deployment foundations for modern products.",
    outcome: "A maintainable foundation ready to scale.",
    icon: CloudCog,
  },
  {
    title: "E-commerce solutions",
    summary: "Focused shopping, booking, and payment experiences built to reduce friction.",
    outcome: "A cleaner path from discovery to purchase.",
    icon: ShoppingBag,
  },
  {
    title: "Maintenance & support",
    summary: "Structured monitoring, improvements, and technical support after launch.",
    outcome: "A product that keeps improving after release.",
    icon: LifeBuoy,
  },
];

export const solutionConcepts = [
  {
    title: "CareFlow",
    category: "Healthcare operations",
    description: "A connected patient operations concept for appointments, care plans, and team visibility.",
    image: "/images/careflow-editorial-v2.png",
    alt: "Tactile editorial installation representing a connected healthcare operations system",
    tags: ["Product strategy", "UX system", "Web platform"],
  },
  {
    title: "Table & Tide",
    category: "Hospitality commerce",
    description: "A premium ordering and booking concept that connects guest discovery with daily operations.",
    image: "/images/table-tide-editorial-v2.png",
    alt: "Editorial hospitality still life with sculptural serving platforms and connected pathways",
    tags: ["E-commerce", "Mobile UX", "Operations"],
  },
] as const;

export const industries = [
  { name: "Healthcare", copy: "Patient journeys, internal operations, and secure information flows.", icon: HeartPulse },
  { name: "Hospitality", copy: "Bookings, ordering, guest experiences, and team coordination.", icon: Hotel },
  { name: "Commerce", copy: "Conversion-focused storefronts and connected fulfilment workflows.", icon: ShoppingBag },
  { name: "Professional services", copy: "Client portals, delivery systems, and reporting tools.", icon: BriefcaseBusiness },
  { name: "Growth teams", copy: "Campaign platforms, lead workflows, and decision-ready analytics.", icon: Megaphone },
  { name: "Digital products", copy: "From early validation to scalable product foundations.", icon: Rocket },
] as const;

export const processSteps = [
  {
    number: "01",
    title: "Discover",
    description: "We align on the business problem, users, constraints, risks, and what a useful result should change.",
    icon: SearchCheck,
  },
  {
    number: "02",
    title: "Define",
    description: "We shape scope, architecture, priorities, and a delivery plan that keeps decisions visible.",
    icon: Workflow,
  },
  {
    number: "03",
    title: "Design",
    description: "We create the interaction model and visual system, then validate the critical journeys early.",
    icon: Sparkles,
  },
  {
    number: "04",
    title: "Build",
    description: "We engineer the product in reviewable increments with security, performance, and maintainability in view.",
    icon: CodeXml,
  },
  {
    number: "05",
    title: "Launch & improve",
    description: "We support release, observe real use, and turn what we learn into the next focused improvements.",
    icon: Gauge,
  },
] as const;

export const capabilities = [
  { label: "Product strategy", icon: ChartNoAxesCombined },
  { label: "Experience design", icon: Layers3 },
  { label: "Web engineering", icon: CodeXml },
  { label: "AI workflows", icon: Bot },
  { label: "Cloud architecture", icon: CloudCog },
  { label: "Data foundations", icon: DatabaseZap },
  { label: "Security-minded delivery", icon: ShieldCheck },
] as const;

export const faqs = [
  {
    question: "What kind of projects do you take on?",
    answer: "We focus on websites, web applications, mobile-ready product experiences, internal platforms, AI-enabled workflows, and the backend systems that support them. The best fit is a project with a clear business problem and an owner who can make decisions with us.",
  },
  {
    question: "Can you work with an existing product?",
    answer: "Yes. We can audit an existing product, improve a specific journey, modernise the interface, stabilise the technical foundation, or take ownership of a clearly defined new module.",
  },
  {
    question: "How do you define scope and cost?",
    answer: "We begin with discovery, clarify assumptions, and break the work into outcomes and delivery phases. You receive a written proposal with scope, timeline, responsibilities, and commercial terms before work begins.",
  },
  {
    question: "How are payments handled?",
    answer: "Projects are normally invoiced against agreed milestones. Payment instructions and records are managed directly with the Arclivo Labs team; no public checkout or automatic payment claim is made on this website.",
  },
  {
    question: "Will we be able to review work during development?",
    answer: "Yes. Delivery is structured around regular checkpoints, working previews, and documented decisions so feedback arrives while it can still improve the outcome.",
  },
  {
    question: "What happens after launch?",
    answer: "We can provide a defined handover, documentation, launch support, and an ongoing maintenance arrangement. The right model depends on the product and your internal team.",
  },
  {
    question: "Do you guarantee business results?",
    answer: "No responsible studio can guarantee revenue or adoption. We commit to clear thinking, careful execution, transparent communication, and measurable product quality—not invented outcomes.",
  },
  {
    question: "How do we get started?",
    answer: "Share the problem, current context, preferred timeline, and any hard constraints through the contact page. We will use that information to decide whether a focused discovery conversation is the right next step.",
  },
] as const;

export const publicPageMetadata = {
  home: {
    title: "Digital products built for real business",
    description: "Arclivo Labs designs and develops conversion-focused websites, web applications, AI workflows, and connected digital products.",
  },
  services: {
    title: "Digital product services",
    description: "Explore Arclivo Labs services across product strategy, UI/UX, website and application development, AI automation, cloud systems, and support.",
  },
  work: {
    title: "Selected solution concepts",
    description: "Explore representative Arclivo Labs product concepts across healthcare operations and hospitality commerce.",
  },
  solutions: {
    title: "Solutions for modern operations",
    description: "See how Arclivo Labs combines product thinking, design, engineering, automation, and cloud systems around business outcomes.",
  },
  about: {
    title: "About our product studio",
    description: "Meet Arclivo Labs, a focused digital product studio helping teams turn operational challenges into useful software.",
  },
  process: {
    title: "Our delivery process",
    description: "See how Arclivo Labs moves from discovery and definition through design, engineering, launch, and continuous improvement.",
  },
  contact: {
    title: "Start a project",
    description: "Tell Arclivo Labs about your digital product, website, platform, automation, or software challenge.",
  },
  careers: {
    title: "Careers and collaboration",
    description: "Learn how designers, engineers, and product thinkers can express interest in collaborating with Arclivo Labs.",
  },
  faq: {
    title: "Frequently asked questions",
    description: "Answers about Arclivo Labs projects, scope, payments, collaboration, delivery, and post-launch support.",
  },
} as const;
