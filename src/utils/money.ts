/** Format number as ARS currency without decimals: "$9.830" */
export function formatPrice(amount: number): string {
  return (
    "$" +
    Math.round(amount)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  );
}

/** Format number with 2 decimal places: "$15.900,00" style for total */
export function formatTotal(amount: number): string {
  const fixed = amount.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${formatted},${decPart}`;
}

/** Plain number without decimals for WhatsApp message */
export function plainPrice(amount: number): string {
  return Math.round(amount).toString();
}

/** Plain number with 2 decimals for WhatsApp total */
export function plainTotal(amount: number): string {
  return amount.toFixed(2);
}
