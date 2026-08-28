import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEgp(value: number | string | undefined | null): string {
  return `${Number(value ?? 0).toFixed(2)} EGP`
}
