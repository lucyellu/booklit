/**
 * Interface Craft - Home Page
 * Design: Clean, minimal, editorial. White background, serif headings, narrow centered column.
 * Card section: 5 fanned/stacked cards with colorful backgrounds and canvas-like textures.
 * Typography: Lora (serif) for headings/display, DM Sans for body.
 * Color: Stone palette, near-black text on white.
 */

import { useEffect, useRef, useState } from "react";

const JOCHEM_AVATAR = "https://d2xsxph8kpxj0f.cloudfront.net/310519663435870347/Ha8zWaAv8j2ERch7Ca3iQM/jochem_a106bf9b.jpg";

// Card data matching the reference
const CARDS = [
  {
    id: 1,
    title: "Working\nKnowledge",
    description: "Frameworks, principles, and models I've learned and developed that you will be able to immediately apply to your practice.",
    bg: "#E54F10",
    textColor: "#FFFFC2",
    descColor: "rgba(255,255,194,0.75)",
    rotate: -8,
    translateX: -420,
    translateY: -154,
    zIndex: 1,
    texture: "lines",
  },
  {
    id: 2,
    title: "Practical\nDemonstration",
    description: "Detailed walkthroughs of designing interfaces, identifying opportunities, and improving through refinement.",
    bg: "#F6EBD9",
    textColor: "#524733",
    descColor: "rgba(82,71,51,0.8)",
    rotate: 4,
    translateX: -265,
    translateY: -124,
    zIndex: 2,
    texture: "grid",
  },
  {
    id: 3,
    title: "Collaborating\nwith AI",
    description: "Video lessons on practical, specific methods of working with AI to get exacting results. Tools covered include Claude Code and v0.",
    bg: "#0A90D2",
    textColor: "#AEFFFF",
    descColor: "rgba(174,255,255,0.8)",
    rotate: -2,
    translateX: -114,
    translateY: -185,
    zIndex: 3,
    texture: "waves",
  },
  {
    id: 4,
    title: "Means &\nMethods",
    description: "General tips and techniques to apply to your daily work to achieve excellence in interface design and assembly.",
    bg: "#53F399",
    textColor: "#004D00",
    descColor: "rgba(0,77,0,0.7)",
    rotate: 1,
    translateX: 33,
    translateY: -128,
    zIndex: 4,
    texture: "code",
  },
  {
    id: 5,
    title: "Interface Kit",
    description: "Screencasts, highlights, and deep dives that showcase the end-to-end journey for designing and building Interface Kit. Members get early betas and free lifetime access to the tool.",
    bg: "#211F1E",
    textColor: "#F6EBD9",
    descColor: "rgba(246,235,217,0.7)",
    rotate: 5,
    translateX: 196,
    translateY: -163,
    zIndex: 5,
    texture: "ui",
  },
];

// Canvas texture renderers
function drawLinesTexture(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1;
  for (let y = 0; y < canvas.height; y += 7) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawGridTexture(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const size = 12;
  // Draw grid lines
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 0.8;
  for (let x = 0; x <= canvas.width; x += size) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += size) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  // Add darker mosaic cells
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  const cells = [
    [1,1],[2,3],[4,2],[5,5],[7,1],[8,4],[10,2],[11,6],[3,7],[6,3],[9,5],[12,1],[13,4],[14,7],
    [0,4],[2,6],[5,1],[7,8],[10,5],[12,3],[1,9],[4,6],[8,2],[11,0],[3,4],[6,7],[9,1],
  ];
  cells.forEach(([cx, cy]) => {
    ctx.fillRect(cx * size, cy * size, size, size);
  });
}

function drawWavesTexture(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1.5;
  const amplitude = 4;
  const frequency = 0.05;
  for (let y = 0; y < canvas.height; y += 10) {
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 2) {
      const yPos = y + Math.sin(x * frequency) * amplitude;
      if (x === 0) ctx.moveTo(x, yPos);
      else ctx.lineTo(x, yPos);
    }
    ctx.stroke();
  }
}

function drawCodeTexture(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "7.5px monospace";
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  const lines = [
    "const design = {",
    "  precision: true,",
    "  craft: 'high',",
    "  care: Infinity,",
    "};",
    "",
    "function refine(ui) {",
    "  return ui.reduce(",
    "    until => clear,",
    "  );",
    "}",
    "",
    "export default design;",
    "// timeless",
    "// unreasonable",
    "const design = {",
    "  precision: true,",
    "  craft: 'high',",
    "};",
    "function refine(ui) {",
    "  return ui.reduce(",
    "    until => clear,",
    "  );",
    "}",
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, 4, 12 + i * 13);
  });
}

function drawUITexture(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(246,235,217,0.3)";
  ctx.lineWidth = 1.5;
  
  // Nested rectangles like UI wireframes
  const rects = [
    { x: 8, y: 8, w: canvas.width - 16, h: canvas.height - 16 },
    { x: 20, y: 20, w: canvas.width - 40, h: canvas.height - 40 },
    { x: 32, y: 32, w: canvas.width - 64, h: canvas.height - 64 },
  ];
  rects.forEach(r => {
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  });
  
  // Vertical dividers
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.4, 8);
  ctx.lineTo(canvas.width * 0.4, canvas.height - 8);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.7, 8);
  ctx.lineTo(canvas.width * 0.7, canvas.height - 8);
  ctx.stroke();
}

interface CardProps {
  card: typeof CARDS[0];
  isActive: boolean;
  onHover: (id: number | null) => void;
}

function CollectionCard({ card, isActive, onHover }: CardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (card.texture === "lines") drawLinesTexture(canvas);
    else if (card.texture === "grid") drawGridTexture(canvas);
    else if (card.texture === "waves") drawWavesTexture(canvas);
    else if (card.texture === "code") drawCodeTexture(canvas);
    else if (card.texture === "ui") drawUITexture(canvas);
  }, [card.texture]);

  return (
    <div
      className="absolute cursor-pointer origin-center select-none"
      style={{
        left: "50%",
        top: "50%",
        zIndex: isActive ? card.zIndex + 10 : card.zIndex,
        transform: `translateX(${card.translateX}px) translateY(${card.translateY + (isActive ? -16 : 0)}px) rotate(${card.rotate}deg)`,
        transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
      onMouseEnter={() => onHover(card.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          backgroundColor: card.bg,
          width: "228px",
          height: "288px",
          boxShadow: isActive 
            ? "0 24px 64px rgba(0,0,0,0.28), 0 8px 24px rgba(0,0,0,0.18)" 
            : "0 4px 20px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.08)",
          transition: "box-shadow 0.3s ease",
        }}
      >
        {/* Texture canvas */}
        <div
          className="absolute overflow-hidden"
          style={{ left: "16px", top: "16px", width: "196px", height: "120px" }}
        >
          <canvas
            ref={canvasRef}
            width={196}
            height={120}
            style={{ width: "196px", height: "120px" }}
          />
        </div>
        
        {/* Title */}
        <h2
          className="absolute font-serif"
          style={{
            color: card.textColor,
            whiteSpace: "pre-line",
            fontSize: isActive ? "30px" : "28px",
            lineHeight: isActive ? "32px" : "30px",
            bottom: isActive ? "84px" : "52px",
            left: "16px",
            transition: "font-size 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), line-height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), bottom 0.35s ease",
            fontFamily: "'Lora', Georgia, serif",
          }}
        >
          {card.title}
        </h2>
        
        {/* Description - shown on hover */}
        <div
          className="absolute"
          style={{
            left: "16px",
            right: "16px",
            bottom: "16px",
            opacity: isActive ? 1 : 0,
            filter: isActive ? "blur(0px)" : "blur(4px)",
            transition: "opacity 0.3s ease, filter 0.3s ease",
          }}
        >
          <p style={{ color: card.descColor, fontSize: "11px", lineHeight: "16px" }}>
            {card.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        margin: "64px auto",
        width: "72px",
        height: "1.5px",
        backgroundColor: "rgba(0,0,0,0.1)",
      }}
    />
  );
}

// Mobile card stack (simplified for small screens)
function MobileCards() {
  return (
    <div className="flex gap-3 overflow-x-auto px-8 pb-4 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
      {CARDS.map((card) => (
        <div
          key={card.id}
          className="flex-none snap-center rounded-2xl overflow-hidden"
          style={{ backgroundColor: card.bg, width: "160px", height: "200px", position: "relative" }}
        >
          <h2
            className="absolute font-serif"
            style={{
              color: card.textColor,
              whiteSpace: "pre-line",
              fontSize: "20px",
              lineHeight: "22px",
              bottom: "16px",
              left: "12px",
              fontFamily: "'Lora', Georgia, serif",
            }}
          >
            {card.title}
          </h2>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [activeCard, setActiveCard] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Fixed Header */}
      <header
        className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-6"
        style={{ paddingTop: "16px", paddingBottom: "16px" }}
      >
        <a href="/" aria-label="Home">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ borderRadius: "4px", overflow: "hidden" }}
          >
            <rect width="16" height="8" fill="#010101" />
            <rect width="16" height="8" transform="translate(16 24)" fill="#1D57F6" />
            <rect width="16" height="8" transform="translate(0 8)" fill="#FD73ED" />
            <rect width="16" height="8" transform="translate(16 16)" fill="#00A1F1" />
            <rect width="16" height="8" transform="translate(0 16)" fill="#E54F10" />
            <rect width="16" height="8" transform="translate(16 8)" fill="#53F399" />
            <rect width="16" height="8" transform="translate(0 24)" fill="#FFD102" />
            <rect width="16" height="8" transform="translate(16)" fill="#F6EBD9" />
          </svg>
        </a>
        <a
          href="/login"
          className="bg-stone-100 px-3 py-1.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-200 transition-colors"
        >
          Login
        </a>
      </header>

      <main>
        {/* Hero Section */}
        <section className="px-8 pt-32 md:pt-40">
          <div className="max-w-2xl mx-auto text-center">
            <div
              style={{
                margin: "0 auto 32px",
                width: "72px",
                height: "1.5px",
                backgroundColor: "rgba(0,0,0,0.1)",
              }}
            />
            <h1
              className="tracking-tight text-stone-900 mb-6"
              style={{
                fontSize: "clamp(36px, 5vw, 50px)",
                lineHeight: "1",
                fontFamily: "'Lora', Georgia, serif",
                fontWeight: 400,
              }}
            >
              Interface Craft
            </h1>
            <p
              className="text-stone-500 mx-auto"
              style={{ fontSize: "18px", lineHeight: "26px", maxWidth: "400px" }}
            >
              A working library for those committed to designing with uncommon care.
            </p>
          </div>
        </section>

        {/* Cards Section - Desktop */}
        <section className="pb-16 hidden md:block" style={{ paddingTop: "48px" }}>
          <div
            className="relative w-full flex items-center justify-center"
            style={{ minHeight: "600px" }}
          >
            <div
              className="relative"
              style={{ width: "900px", height: "550px" }}
            >
              {CARDS.map((card) => (
                <CollectionCard
                  key={card.id}
                  card={card}
                  isActive={activeCard === card.id}
                  onHover={setActiveCard}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Cards Section - Mobile */}
        <section className="pb-8 md:hidden" style={{ paddingTop: "32px" }}>
          <MobileCards />
        </section>

        {/* Intro Text Section */}
        <section className="px-8 pt-8 md:pt-20">
          <div className="mx-auto" style={{ maxWidth: "540px" }}>
            <div
              className="space-y-6 text-stone-600"
              style={{ fontSize: "18px", lineHeight: "28px" }}
            >
              <p>
                Software is rapidly getting easier to make. And most of what gets made will probably be fine. Functional, but forgettable. Made quickly without much thought.
              </p>
              <p>This is for people who want to make something else.</p>
              <p>
                Products that are loved. Interfaces that feel{" "}
                <a
                  href="https://x.com/NelsonNoa/status/2009468494136643987"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-stone-700/90 hover:text-black underline underline-offset-2 decoration-stone-700/30 transition-colors"
                >
                  timeless
                </a>
                . Experiences that welcome you in and anticipate your needs. Software that feels right. Like it was made by someone who took the time to apply an almost{" "}
                <a
                  href="https://x.com/soleio/status/402852206686113792"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-stone-700/90 hover:text-black underline underline-offset-2 decoration-stone-700/30 transition-colors"
                >
                  unreasonable
                </a>{" "}
                level of consideration.
              </p>
            </div>

            <Divider />

            <div
              className="space-y-6 text-stone-600"
              style={{ fontSize: "18px", lineHeight: "28px" }}
            >
              <h2
                className="font-semibold text-stone-900"
                style={{ fontSize: "18px", fontFamily: "'DM Sans', system-ui, sans-serif" }}
              >
                Library
              </h2>
              <p>
                Whether you are a designer, engineer, or founder you will find value here. My intent is to create a space that can serve as a container for me to share what I continue to create and learn.
              </p>
              <p>
                At launch, there will be five collections. They will contain articles, videos, interactive playgrounds, examples, and a curated set of references for further study. More collections will come.
              </p>
            </div>

            <Divider />

            <div
              className="space-y-6 text-stone-600"
              style={{ fontSize: "18px", lineHeight: "28px" }}
            >
              <h2
                className="font-semibold text-stone-900"
                style={{ fontSize: "18px", fontFamily: "'DM Sans', system-ui, sans-serif" }}
              >
                Author
              </h2>
              <p>
                My name is{" "}
                <a
                  href="https://joshpuckett.me/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-stone-700/90 hover:text-black underline underline-offset-2 decoration-stone-700/30 transition-colors"
                >
                  Josh Puckett
                </a>
                , and I've spent nearly two decades designing products like Wealthfront, Dropbox and helping dozens of early-stage founders create theirs.
              </p>

              {/* Testimonial blockquote */}
              <div
                className="pl-6"
                style={{
                  borderLeft: "1.5px solid rgba(0,0,0,0.1)",
                  margin: "32px 0",
                }}
              >
                <p
                  className="text-stone-800 mb-6"
                  style={{
                    fontSize: "18px",
                    lineHeight: "28px",
                    textIndent: "-0.4em",
                    fontFamily: "'Lora', Georgia, serif",
                  }}
                >
                  "Josh taught me how to reduce until it's clear and refine until it's right. I apply what I learned from him daily, and you should too."
                </p>
                <div className="flex items-center gap-3">
                  <img
                    src={JOCHEM_AVATAR}
                    alt="Jochem"
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full object-cover flex-none"
                  />
                  <div className="text-left">
                    <a
                      href="https://www.jochem.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-stone-900 font-medium hover:text-black underline underline-offset-2 decoration-stone-900/30 transition-colors"
                      style={{ fontSize: "15px", lineHeight: "20px" }}
                    >
                      Jochem
                    </a>
                    <div className="text-stone-500" style={{ fontSize: "15px", lineHeight: "20px" }}>
                      Design at Cardless
                    </div>
                  </div>
                </div>
              </div>

              <p>
                I've{" "}
                <a
                  href="https://upperstudy.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-stone-700/90 hover:text-black underline underline-offset-2 decoration-stone-700/30 transition-colors"
                >
                  apprenticed
                </a>{" "}
                hundreds of designers who are now working at companies like Apple, Browserbase, Cardless, and many other fast-growing startups. I've learned and discovered much about the art and science of designing exceptional products over my career. I'm excited to share it with you.
              </p>
            </div>
          </div>
        </section>

        <Divider />

        {/* Membership Section */}
        <section className="px-8 pb-36">
          <div className="mx-auto" style={{ maxWidth: "540px" }}>
            <h2
              className="font-semibold text-stone-900 mb-5"
              style={{ fontSize: "18px", fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              Membership
            </h2>
            <div
              className="text-stone-600 mb-8"
              style={{ fontSize: "18px", lineHeight: "28px" }}
            >
              <p>
                Pay once and gain access to the Library for life. Membership includes all content, skills, and resources available today, and all future updates as well.
              </p>
            </div>
            <button
              className="px-6 py-3 rounded-full text-lg font-medium bg-stone-900 text-white hover:bg-stone-700 transition-colors"
              style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              Join for $199{" "}
              <span className="line-through text-stone-500">$249</span>
            </button>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-8 pb-36">
          <div className="mx-auto" style={{ maxWidth: "540px" }}>
            <h2
              className="font-semibold text-stone-900 mb-8"
              style={{ fontSize: "18px", fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              Questions
            </h2>
            <div className="space-y-8" style={{ fontSize: "18px", lineHeight: "28px" }}>
              <div>
                <h3 className="font-medium text-stone-900 mb-2">
                  Is this for designers, or developers?
                </h3>
                <p className="text-stone-600">
                  Both. You will benefit if you are involved in the creation of software, as a designer, developer, or product manager. While some content will touch on technical implementation (though largely using AI assistance), much of this will be agnostic of a specific implementation method such as Figma or Code.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-stone-900 mb-2">
                  How much experience do I need for this to help me?
                </h3>
                <p className="text-stone-600">
                  The Library contains material valuable for both newer designers and those who have been building for decades. That said, it assumes a working familiarity with the fundamentals of interface design. In the near future I plan to have more content focused on absolute beginners.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-stone-900 mb-2">
                  How often will the Library be updated?
                </h3>
                <p className="text-stone-600">
                  I plan to regularly update the content, both refining what exists and adding new material. Expect monthly updates at a minimum. See the{" "}
                  <a
                    href="/updates"
                    className="font-medium text-stone-700/90 hover:text-black underline underline-offset-2 decoration-stone-700/30 transition-colors"
                  >
                    library updates
                  </a>{" "}
                  for a full log.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-stone-900 mb-2">
                  Do you offer Purchasing Power Parity?
                </h3>
                <p className="text-stone-600">
                  Yes. When visiting from an eligible country, regional pricing is applied automatically.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-stone-900 mb-2">
                  Do you offer an educational discount?
                </h3>
                <p className="text-stone-600">
                  Yes, please send me an{" "}
                  <a
                    href="mailto:hello@joshpuckett.me"
                    className="font-medium text-stone-700/90 hover:text-black underline underline-offset-2 decoration-stone-700/30 transition-colors"
                  >
                    email
                  </a>{" "}
                  with proof of enrollment for an educational discount code.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-stone-900 mb-2">
                  Can I get a bulk purchase discount for my team?
                </h3>
                <p className="text-stone-600">
                  Yes, I'm happy to provide discounts for larger orders, just send me an{" "}
                  <a
                    href="mailto:hello@joshpuckett.me"
                    className="font-medium text-stone-700/90 hover:text-black underline underline-offset-2 decoration-stone-700/30 transition-colors"
                  >
                    email
                  </a>
                  .
                </p>
              </div>
              <div>
                <h3 className="font-medium text-stone-900 mb-2">
                  Can I access the resources on mobile?
                </h3>
                <p className="text-stone-600">
                  Yes, everything is accessible on mobile, but some resources—particularly the interactive demonstrations—are best experienced on the web.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-8 pb-12 text-center">
        <p className="text-xs text-stone-400">
          © 2026 The California Interface &amp; Trade Company, LLC
        </p>
      </footer>
    </div>
  );
}
