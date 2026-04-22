import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://eyes4ai.selcukcihan.com",
  base: "/",
  integrations: [
    starlight({
      title: "eyes4ai",
      description: "Passive AI activity recorder for Git repositories.",
      logo: {
        src: "./src/assets/logo.svg",
        alt: "eyes4ai logo",
      },
      favicon: "/favicon.png",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/selcukcihan/eyes4ai",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", slug: "getting-started/introduction" },
            { label: "Installation", slug: "getting-started/installation" },
            { label: "Quick Start", slug: "getting-started/quick-start" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Configuration", slug: "guides/configuration" },
            { label: "Report Format", slug: "guides/report-format" },
            { label: "Supported Tools", slug: "guides/supported-tools" },
            { label: "Troubleshooting", slug: "guides/troubleshooting" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "CLI Commands", slug: "reference/cli" },
            { label: "Event Schema", slug: "reference/schema" },
            { label: "Architecture", slug: "reference/architecture" },
          ],
        },
      ],
    }),
  ],
});
