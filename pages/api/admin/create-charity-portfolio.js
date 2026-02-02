import { handleCORS } from "../../../lib/api-helpers.js";
import { protect, authorize } from "../../../lib/auth.js";
import connectDB from "../../../lib/mongodb.js";
import Portfolio from "../../../models/Portfolio.js";
import { getAllUsers } from "../../../lib/user-helper.js";
import { createPortfolio } from "../../../lib/portfolio-helper.js";

/**
 * Admin endpoint to create a full portfolio for charityhends@gmail.com
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    // Check authentication and admin role
    const authResult = await protect(req);
    if (!authResult.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const isAdmin =
      authResult.user.role === "admin" || authResult.user.role === "owner";
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    await connectDB();

    // Find user by email
    const users = await getAllUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === "charityhends@gmail.com".toLowerCase()
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with email: charityhends@gmail.com",
        availableUsers: users.map((u) => ({ email: u.email, name: u.name })),
      });
    }

    // Check if portfolio already exists
    const existingPortfolio = await Portfolio.findOne({ studentId: user._id });

    if (existingPortfolio) {
      // Update existing portfolio
      const portfolioData = getFullPortfolioData(user._id);
      await Portfolio.findByIdAndUpdate(existingPortfolio._id, portfolioData, {
        new: true,
        runValidators: false,
      });

      return res.json({
        success: true,
        message: "Portfolio updated successfully",
        portfolio: {
          _id: existingPortfolio._id,
          slug: portfolioData.slug,
        },
      });
    }

    // Create new portfolio
    const portfolioData = getFullPortfolioData(user._id);
    const portfolio = await createPortfolio(portfolioData);

    return res.json({
      success: true,
      message: "Portfolio created successfully",
      portfolio: {
        _id: portfolio._id,
        slug: portfolio.slug,
      },
    });
  } catch (error) {
    console.error("Error creating portfolio:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating portfolio",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

function getFullPortfolioData(studentId) {
  return {
    studentId: studentId,
    slug: "charityhends",
    visibility: "public",
    layout: {
      type: "single-page",
      blocks: [],
    },
    status: "published",
    theme: {
      name: "modern",
      colors: {
        primary: "#2563eb",
        secondary: "#64748b",
        background: "#ffffff",
        text: "#1e293b",
        accent: "#0ea5e9",
      },
      fonts: {
        heading: "Inter, system-ui, sans-serif",
        body: "Inter, system-ui, sans-serif",
      },
      styles: {
        spacing: "comfortable",
        headingSize: "2.5rem",
        bodySize: "1rem",
      },
      typography: {},
    },
    hero: {
      title: "Charity Henderson",
      subtitle: "Student Programmer & Full-Stack Developer",
      description:
        "Passionate about creating innovative web applications and solving complex problems through code. Currently pursuing Computer Science with a focus on modern web technologies.",
      image: null,
      avatar: null,
      ctaText: "View My Projects",
      ctaLink: "#projects",
    },
    sections: [
      {
        type: "about",
        title: "About Me",
        order: 0,
        slug: "about",
        content: {
          text: "I'm a dedicated student programmer with a passion for full-stack web development. I specialize in JavaScript, React, Node.js, and modern web technologies. My journey in programming started during high school, and I've been continuously learning and building projects ever since.\n\nI enjoy working on challenging projects that push my boundaries and help me grow as a developer. When I'm not coding, I contribute to open-source projects and participate in coding competitions.",
        },
      },
      {
        type: "skills",
        title: "Skills",
        order: 1,
        slug: "skills",
        content: {
          skills: [
            {
              name: "JavaScript",
              level: 90,
              category: "Programming Languages",
            },
            {
              name: "React",
              level: 85,
              category: "Frontend Frameworks",
            },
            {
              name: "Node.js",
              level: 80,
              category: "Backend",
            },
            {
              name: "Python",
              level: 75,
              category: "Programming Languages",
            },
            {
              name: "HTML/CSS",
              level: 95,
              category: "Web Technologies",
            },
            {
              name: "MongoDB",
              level: 70,
              category: "Databases",
            },
            {
              name: "Git",
              level: 85,
              category: "Tools",
            },
            {
              name: "TypeScript",
              level: 75,
              category: "Programming Languages",
            },
          ],
        },
      },
      {
        type: "projects",
        title: "Projects",
        order: 2,
        slug: "projects",
        content: {
          projects: [
            {
              title: "E-Commerce Platform",
              description:
                "Full-stack e-commerce application built with React, Node.js, and MongoDB. Features include user authentication, product management, shopping cart, and payment integration.",
              date: "2024-01-15",
              technologies: [
                "React",
                "Node.js",
                "MongoDB",
                "Express",
                "Stripe API",
              ],
              githubUrl: "https://github.com/charityhends/ecommerce-platform",
              demoUrl: "https://ecommerce-demo.example.com",
              image: null,
            },
            {
              title: "Task Management App",
              description:
                "Collaborative task management application with real-time updates. Built using React, Socket.io, and PostgreSQL. Features drag-and-drop interface and team collaboration tools.",
              date: "2023-11-20",
              technologies: ["React", "Socket.io", "PostgreSQL", "Express"],
              githubUrl: "https://github.com/charityhends/task-manager",
              demoUrl: "https://taskmanager-demo.example.com",
              image: null,
            },
            {
              title: "Weather Dashboard",
              description:
                "Interactive weather dashboard that displays real-time weather data from multiple cities. Built with React and integrated with OpenWeatherMap API.",
              date: "2023-09-10",
              technologies: [
                "React",
                "JavaScript",
                "OpenWeatherMap API",
                "Chart.js",
              ],
              githubUrl: "https://github.com/charityhends/weather-dashboard",
              demoUrl: "https://weather-demo.example.com",
              image: null,
            },
            {
              title: "Portfolio Website",
              description:
                "Personal portfolio website showcasing my projects and skills. Built with React and modern CSS animations. Fully responsive and optimized for performance.",
              date: "2023-08-05",
              technologies: ["React", "CSS3", "Framer Motion"],
              githubUrl: "https://github.com/charityhends/portfolio",
              demoUrl: "https://charityhends.dev",
              image: null,
            },
          ],
        },
      },
      {
        type: "achievements",
        title: "Achievements",
        order: 3,
        slug: "achievements",
        content: {
          achievements: [
            {
              title: "First Place - University Hackathon 2024",
              description:
                "Won first place in the annual university hackathon with my team's innovative solution for sustainable energy management.",
              date: "2024-03-15",
              awardedBy: "University Tech Department",
            },
            {
              title: "Outstanding Student Developer",
              description:
                "Recognized for exceptional contributions to open-source projects and active participation in coding communities.",
              date: "2023-12-10",
              awardedBy: "Computer Science Department",
            },
            {
              title: "Best Web App - Student Competition",
              description:
                "Awarded best web application in the annual student programming competition.",
              date: "2023-06-20",
              awardedBy: "Tech Student Association",
            },
            {
              title: "GitHub Student Developer Pack",
              description:
                "Selected for GitHub Student Developer Pack, providing access to premium developer tools and resources.",
              date: "2023-05-01",
              awardedBy: "GitHub Education",
            },
          ],
        },
      },
      {
        type: "education",
        title: "Education",
        order: 4,
        slug: "education",
        content: {
          education: [
            {
              title: "Bachelor of Science in Computer Science",
              institution: "State University",
              date: "2022 - Present",
              description:
                "Currently pursuing a Bachelor's degree in Computer Science with a focus on Software Engineering and Web Development. Maintaining a 3.8 GPA.",
              location: "City, State",
            },
            {
              title: "High School Diploma",
              institution: "City High School",
              date: "2018 - 2022",
              description:
                "Graduated with honors. Participated in computer science club and coding competitions.",
              location: "City, State",
            },
          ],
        },
      },
      {
        type: "certificates",
        title: "Certificates",
        order: 5,
        slug: "certificates",
        content: {
          certificates: [],
        },
      },
    ],
    certificates: [],
    animations: {
      enabled: true,
      type: "fade",
    },
    // New portfolio features
    imageGallery: [
      {
        id: "img-1",
        url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800",
        title: "Coding Workspace",
        description: "My development setup",
        order: 0,
      },
      {
        id: "img-2",
        url: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800",
        title: "Project Screenshot",
        description: "E-commerce platform interface",
        order: 1,
      },
      {
        id: "img-3",
        url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800",
        title: "Team Collaboration",
        description: "Working with my team on hackathon project",
        order: 2,
      },
    ],
    seo: {
      metaDescription:
        "Charity Henderson - Student Programmer and Full-Stack Developer. Portfolio showcasing web development projects, skills, and achievements.",
      metaKeywords:
        "student programmer, full-stack developer, web development, React, Node.js, JavaScript, portfolio",
      ogTitle: "Charity Henderson - Student Programmer Portfolio",
      ogDescription:
        "Passionate student programmer specializing in full-stack web development with React and Node.js.",
      ogImage: "",
      twitterCard: "summary_large_image",
    },
    socialLinks: [
      {
        platform: "GitHub",
        url: "https://github.com/charityhends",
        icon: "github",
        order: 0,
      },
      {
        platform: "LinkedIn",
        url: "https://linkedin.com/in/charityhends",
        icon: "linkedin",
        order: 1,
      },
      {
        platform: "Twitter",
        url: "https://twitter.com/charityhends",
        icon: "twitter",
        order: 2,
      },
      {
        platform: "Portfolio",
        url: "https://charityhends.dev",
        icon: "globe",
        order: 3,
      },
    ],
    sharing: {
      enabled: true,
      showShareButtons: true,
      allowEmbedding: true,
      customMessage: "Check out my portfolio!",
      qrCodeEnabled: true,
    },
    analytics: {
      enabled: false,
      googleAnalyticsId: "",
      googleTagManagerId: "",
      customTrackingCode: "",
      enableViewTracking: false,
    },
    customCode: {
      css: "",
      javascript: "",
    },
    favicon: "",
    background: {
      type: "color",
      color: "#ffffff",
      image: null,
      gradient: null,
    },
    fonts: {
      headingFont: "Inter, system-ui, sans-serif",
      bodyFont: "Inter, system-ui, sans-serif",
      headingWeight: "700",
      bodyWeight: "400",
      letterSpacing: "normal",
      lineHeight: "1.6",
    },
    statistics: {
      showViews: true,
      showLikes: false,
    },
  };
}
