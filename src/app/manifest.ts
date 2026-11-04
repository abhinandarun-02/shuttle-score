import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shuttle — Badminton tournaments",
    short_name: "Shuttle",
    description: "Create a badminton tournament, share a link, and keep live scores in sync. No sign-up.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f9f5",
    theme_color: "#f8f9f5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
