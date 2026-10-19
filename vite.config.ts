import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		preact(),
		VitePWA({
			registerType: "autoUpdate",
			includeManifestIcons: false,
			manifest: {
				name: "Yggdrasil FT — family tree",
				short_name: "Yggdrasil FT",
				description: "Local-only family tree and genealogy research workspace.",
				theme_color: "#0c100e",
				background_color: "#0c100e",
				display: "standalone",
				start_url: "/",
				scope: "/",
				icons: [
					{
						src: "/icons/icon-192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "/icons/icon-512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "/icons/icon-maskable-512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
				navigateFallback: "/index.html",
			},
		}),
	],
	build: {
		target: "es2022",
	},
});
