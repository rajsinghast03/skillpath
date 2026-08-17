import { addPropertyControls, ControlType } from "framer";
import { useEffect, useState, useCallback, type CSSProperties } from "react";

/**
 * Courses — fetches live course data + country code from the assignment API
 * and renders a responsive grid of course cards.
 *
 * The API is intentionally flaky (~1 in 3 requests fail), so every fetch is
 * retried with a small backoff. Four states are rendered explicitly:
 * loading (skeleton), error (with retry), empty, and success.
 */

const BASE_URL = "https://syncsphere-hiv6.onrender.com";

/** How many times to retry a failing request before giving up. */
const MAX_RETRIES = 3;
/** Base delay (ms) for exponential backoff between retries. */
const RETRY_DELAY_MS = 500;

interface Course {
  courseName: string;
  courseCode: string;
  description: string;
  mainCategory: string;
  shortCourse: string;
  courseType: string;
  pricePaise: number;
  priceUsdCents: number;
  mangoId: string;
  refundable: boolean;
}

type CountryCode = "IN" | "US";
type Status = "loading" | "error" | "empty" | "success";

/**
 * Fetch JSON with retry + exponential backoff. The endpoint randomly returns
 * 404/500, so a single attempt is not reliable enough to show real data.
 * Only GET is ever issued — anything else is a 405 by design.
 */
async function fetchJsonWithRetry(url: string): Promise<any> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return await res.json();
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1))
      );
    }
  }
  throw lastError;
}

/**
 * Format a course price for the detected country. The API gives paise and
 * cents (subunits), so divide by 100 — 199900 paise is ₹1,999.00, not
 * ₹1,99,900. Uses Intl.NumberFormat for the correct grouping + symbol.
 */
function formatPrice(course: Course, country: CountryCode): string {
  if (country === "IN") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(course.pricePaise / 100);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(course.priceUsdCents / 100);
}

interface CoursesProps {
  heading: string;
  accentColor: string;
  style?: CSSProperties;
}

/**
 * Courses
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function Courses(props: CoursesProps) {
  const { heading = "Popular Courses", accentColor = "#FF6B35" } = props;

  const [status, setStatus] = useState<Status>("loading");
  const [courses, setCourses] = useState<Course[]>([]);
  // Start with IN; if the country call succeeds it overrides. We keep courses
  // visible even when only the country endpoint fails (see loadCourses).
  const [country, setCountry] = useState<CountryCode>("IN");
  const [countryFailed, setCountryFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [sortByPrice, setSortByPrice] = useState(false);

  const loadCourses = useCallback(async () => {
    setStatus("loading");
    setCountryFailed(false);
    try {
      // Fetch both in parallel; handle them independently so one failing does
      // not take the other down.
      const coursePromise = fetchJsonWithRetry(`${BASE_URL}/assignment/course-data`);
      const countryPromise = fetchJsonWithRetry(`${BASE_URL}/assignment/country-code`);

      const [courseResult, countryResult] = await Promise.allSettled([
        coursePromise,
        countryPromise,
      ]);

      if (courseResult.status === "rejected") {
        // No courses at all — this is the unrecoverable case.
        setStatus("error");
        return;
      }

      const list: Course[] = Array.isArray(courseResult.value)
        ? courseResult.value
        : [];

      if (countryResult.status === "fulfilled") {
        const code = countryResult.value?.country_code;
        setCountry(code === "US" ? "US" : "IN");
      } else {
        // Courses loaded but country did not. Wrong answer: blank the section
        // or guess randomly. Right-ish answer: fall back to INR (the data is
        // India-centric) and flag it so a learner is not misled.
        setCountry("IN");
        setCountryFailed(true);
      }

      if (list.length === 0) {
        setStatus("empty");
        setCourses([]);
      } else {
        setCourses(list);
        setStatus("success");
      }
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses, reloadKey]);

  const retry = () => setReloadKey((k) => k + 1);

  // Bonus: client-side search filter + sort by price.
  const numericPrice = (c: Course) =>
    country === "IN" ? c.pricePaise / 100 : c.priceUsdCents / 100;

  const visible = courses
    .filter((c) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        c.courseName.toLowerCase().includes(q) ||
        c.mainCategory.toLowerCase().includes(q) ||
        c.shortCourse.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (sortByPrice ? numericPrice(a) - numericPrice(b) : 0));

  const root: CSSProperties = {
    width: "100%",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  };

  const toolbar: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
  };

  const inputStyle: CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "2px solid #E7E5E4",
    fontSize: 14,
    outline: "none",
    minWidth: 220,
    flex: "1 1 220px",
    maxWidth: 360,
  };

  const sortBtn: CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: `2px solid ${accentColor}`,
    background: sortByPrice ? accentColor : "transparent",
    color: sortByPrice ? "#fff" : accentColor,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  if (status === "loading") {
    return (
      <div style={{ ...root, ...props.style }}>
        <SectionHeading heading={heading} accentColor={accentColor} />
        <div className="sp-grid" style={gridStyle()}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="sp-skel" style={skelCard} />
          ))}
        </div>
        <style>{CSS_TEXT}</style>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ ...root, ...props.style, alignItems: "center", padding: "40px 0" }}>
        <SectionHeading heading={heading} accentColor={accentColor} />
        <div style={stateCard}>
          <div style={{ fontSize: 44 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1917" }}>
            Couldn't load courses
          </div>
          <div style={{ fontSize: 14, color: "#78716C", maxWidth: 360 }}>
            Something went wrong while fetching the course list. Please try again.
          </div>
          <button onClick={retry} style={{ ...sortBtn, background: accentColor, color: "#fff", border: "none" }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div style={{ ...root, ...props.style, alignItems: "center", padding: "40px 0" }}>
        <SectionHeading heading={heading} accentColor={accentColor} />
        <div style={stateCard}>
          <div style={{ fontSize: 44 }}>🗂️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1917" }}>
            No courses right now
          </div>
          <div style={{ fontSize: 14, color: "#78716C", maxWidth: 360 }}>
            The catalogue came back empty. Check back soon — or reload to refetch.
          </div>
          <button onClick={retry} style={{ ...sortBtn, background: accentColor, color: "#fff", border: "none" }}>
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...root, ...props.style }}>
      <SectionHeading heading={heading} accentColor={accentColor} />

      {countryFailed && (
        <div style={noticeBar}>
          Prices shown in ₹ INR — we couldn't detect your region.
        </div>
      )}

      <div style={toolbar}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses or categories…"
          aria-label="Search courses"
          style={inputStyle}
        />
        <button
          onClick={() => setSortByPrice((s) => !s)}
          aria-pressed={sortByPrice}
          style={sortBtn}
        >
          {sortByPrice ? "Price: low → high ✓" : "Sort by price"}
        </button>
      </div>

      {visible.length === 0 ? (
        <div style={{ color: "#78716C", fontSize: 14, padding: "24px 0" }}>
          No courses match “{query}”.
        </div>
      ) : (
        <div className="sp-grid" style={gridStyle()}>
          {visible.map((course) => (
            <CourseCard
              key={course.mangoId || course.courseCode}
              course={course}
              country={country}
              accentColor={accentColor}
            />
          ))}
        </div>
      )}
      <style>{CSS_TEXT}</style>
    </div>
  );
}

function SectionHeading({
  heading,
  accentColor,
}: {
  heading: string;
  accentColor: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          background: accentColor,
          display: "inline-block",
          transform: "rotate(8deg)",
        }}
      />
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#1C1917" }}>
        {heading}
      </h2>
    </div>
  );
}

function CourseCard({
  course,
  country,
  accentColor,
}: {
  course: Course;
  country: CountryCode;
  accentColor: string;
}) {
  return (
    <article className="sp-card" style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ ...chip, background: accentColor }}>{course.mainCategory}</span>
        {course.refundable && <span style={refundBadge}>Refundable</span>}
      </div>

      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1C1917" }}>
        {course.courseName}
      </h3>

      {/* Two-line clamp, cleanly. */}
      <p className="sp-desc" style={descStyle}>
        {course.description}
      </p>

      <div style={{ marginTop: "auto", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: accentColor }}>
          {formatPrice(course, country)}
        </span>
        <span style={{ fontSize: 12, color: "#A8A29E" }}>{course.courseType}</span>
      </div>
    </article>
  );
}

const cardStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  border: "1px solid #F0EDEA",
  boxShadow: "0 4px 14px rgba(28,25,23,0.06)",
  height: "100%",
  boxSizing: "border-box",
};

const chip: CSSProperties = {
  color: "#fff",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.02em",
  padding: "4px 10px",
  borderRadius: 999,
  textTransform: "uppercase",
};

const refundBadge: CSSProperties = {
  color: "#047857",
  background: "#D1FAE5",
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 10px",
  borderRadius: 999,
};

const descStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.5,
  color: "#57534E",
};

const stateCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  background: "#fff",
  borderRadius: 20,
  padding: "40px 28px",
  border: "1px solid #F0EDEA",
  textAlign: "center",
  maxWidth: 440,
};

const noticeBar: CSSProperties = {
  background: "#FFF7ED",
  border: "1px solid #FED7AA",
  color: "#9A3412",
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 12px",
  borderRadius: 12,
  alignSelf: "flex-start",
};

const skelCard: CSSProperties = {
  background: "#EFECE9",
  borderRadius: 20,
  height: 220,
  border: "1px solid #F0EDEA",
};

function gridStyle(): CSSProperties {
  // Column count is driven by the .sp-grid media queries below, not inline
  // styles, so it responds to viewport width in both the Framer canvas and the
  // published site. Any card count works because we never fix the row count.
  return {
    display: "grid",
    gap: 20,
    width: "100%",
  };
}

/* Responsive grid: 3 → 2 (tablet) → 1 (mobile). */
const CSS_TEXT = `
.sp-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
@media (max-width: 900px) { .sp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .sp-grid { grid-template-columns: minmax(0, 1fr); } }
.sp-desc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
@keyframes sp-pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
.sp-skel { animation: sp-pulse 1.4s ease-in-out infinite; }
`;

addPropertyControls(Courses, {
  heading: {
    type: ControlType.String,
    title: "Heading",
    defaultValue: "Popular Courses",
    placeholder: "Section heading…",
  },
  accentColor: {
    type: ControlType.Color,
    title: "Accent Color",
    defaultValue: "#FF6B35",
  },
});
