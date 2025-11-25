import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				// SomniaForge Brand Colors - Use sparingly for accents only
				brand: {
					primary: '#fe54ff',
					secondary: '#a064ff',
					accent: '#61f1fd',
					deep: '#3e2974',
					purple: '#af1acc'
				},
				// Professional Interface Colors - 90% of design
				'background-secondary': 'var(--background-secondary)',
				'background-tertiary': 'var(--background-tertiary)',
				'background-hover': 'var(--background-hover)',
				'surface-secondary': 'var(--surface-secondary)',
				'surface-tertiary': 'var(--surface-tertiary)',
				'foreground-secondary': 'var(--foreground-secondary)',
				'foreground-tertiary': 'var(--foreground-tertiary)',
				'foreground-quaternary': 'var(--foreground-quaternary)',
				'border-secondary': 'var(--border-secondary)',
				'border-hover': 'var(--border-hover)',

				// Semantic Colors mapped to professional palette
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				success: '#00d084',
				warning: '#f5a623',
				error: '#e60026',
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				status: {
					draft: 'hsl(var(--status-draft))',
					compiled: 'hsl(var(--status-compiled))',
					deployed: 'hsl(var(--status-deployed))',
				}
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-secondary': 'var(--gradient-secondary)',
				'gradient-accent': 'var(--gradient-accent)',
				'gradient-hero': 'var(--gradient-hero)',
				'gradient-glass': 'var(--gradient-glass)'
			},
			boxShadow: {
				'soft': 'var(--shadow-soft)',
				'glow': 'var(--shadow-glow)',
				'window': 'var(--shadow-window)'
			},
			fontFamily: {
				'geist': ['var(--font-geist)'],
				'sans': ['var(--font-inter)'],
				'mono': ['var(--font-mono)'],
				heading: ['Geist', 'Inter', 'system-ui', 'sans-serif']
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [
		tailwindcssAnimate,
		typography,
		function({ addUtilities }) {
			addUtilities({
				// Typography System - Design System Compliant
				'.text-display-xl': {
					'font-size': '3rem',
					'font-weight': '700',
					'font-family': 'var(--font-geist)',
					'line-height': '1.1',
					'letter-spacing': '-0.02em'
				},
				'.text-display-lg': {
					'font-size': '2rem',
					'font-weight': '700',
					'font-family': 'var(--font-geist)',
					'line-height': '1.1',
					'letter-spacing': '-0.01em'
				},
				'.text-display-md': {
					'font-size': '1.5rem',
					'font-weight': '700',
					'font-family': 'var(--font-geist)',
					'line-height': '1.2',
					'letter-spacing': '-0.01em'
				},
				'.text-display-sm': {
					'font-size': '1.125rem',
					'font-weight': '600',
					'font-family': 'var(--font-geist)',
					'line-height': '1.2',
					'letter-spacing': '0'
				},
				'.text-heading-xl': {
					'font-size': '1.5rem',
					'font-weight': '600',
					'font-family': 'var(--font-geist)',
					'line-height': '1.25'
				},
				'.text-heading-lg': {
					'font-size': '1.25rem',
					'font-weight': '600',
					'font-family': 'var(--font-geist)',
					'line-height': '1.25'
				},
				'.text-heading-md': {
					'font-size': '1.125rem',
					'font-weight': '600',
					'font-family': 'var(--font-geist)',
					'line-height': '1.25'
				},
				'.text-heading-sm': {
					'font-size': '1rem',
					'font-weight': '600',
					'font-family': 'var(--font-geist)',
					'line-height': '1.25'
				},
				'.text-body-lg': {
					'font-size': '1rem',
					'font-family': 'var(--font-inter)',
					'line-height': '1.5'
				},
				'.text-body-md': {
					'font-size': '0.875rem',
					'font-family': 'var(--font-inter)',
					'line-height': '1.5'
				},
				'.text-body-sm': {
					'font-size': '0.8125rem',
					'font-family': 'var(--font-inter)',
					'line-height': '1.5'
				},
				'.text-body-xs': {
					'font-size': '0.75rem',
					'font-family': 'var(--font-inter)',
					'line-height': '1.4'
				},
				'.text-label-lg': {
					'font-size': '0.875rem',
					'font-weight': '500',
					'font-family': 'var(--font-geist)'
				},
				'.text-label-md': {
					'font-size': '0.75rem',
					'font-weight': '500',
					'font-family': 'var(--font-geist)',
					'text-transform': 'uppercase',
					'letter-spacing': '0.05em'
				},
				'.text-label-sm': {
					'font-size': '0.75rem',
					'font-weight': '500',
					'font-family': 'var(--font-geist)',
					'text-transform': 'uppercase',
					'letter-spacing': '0.1em'
				},
				'.text-code-lg': {
					'font-size': '1rem',
					'font-family': 'var(--font-mono)',
					'line-height': '1.6'
				},
				'.text-code-md': {
					'font-size': '0.875rem',
					'font-family': 'var(--font-mono)',
					'line-height': '1.6'
				},
				'.text-code-sm': {
					'font-size': '0.75rem',
					'font-family': 'var(--font-mono)',
					'line-height': '1.6'
				}
			});
		}
	],
} satisfies Config;