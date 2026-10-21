import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata uma string numérica para o padrão de telefone brasileiro (celular ou fixo).
 */
export const formatPhoneNumber = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

/**
 * Remove caracteres não numéricos e o prefixo DDI 55 se presente.
 */
export const cleanRawNumber = (raw: string) => {
  let numbers = raw.replace(/\D/g, '');
  if ((numbers.length === 12 || numbers.length === 13) && numbers.startsWith('55')) {
    numbers = numbers.slice(2);
  }
  return numbers;
};
