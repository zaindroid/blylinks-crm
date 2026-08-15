// PKR Currency Formatter Utility
export function formatPKR(amount) {
  const num = Number(amount) || 0;
  return `Rs. ${num.toLocaleString('en-PK')}`;
}
