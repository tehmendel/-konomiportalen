import { extractVendorKey } from './categorize'

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7)
}

// Groups expense transactions by vendor and flags ones that look like a
// recurring/fixed cost: same vendor, showing up in at least two different
// months, with an amount that stays within ±20% of its own median.
export function detectRecurringExpenses(transactions) {
  const groups = new Map()
  for (const t of transactions) {
    const key = extractVendorKey(t.description)
    if (key.length < 3) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(t)
  }

  const results = []
  for (const [key, txs] of groups) {
    const months = new Set(txs.map((t) => monthKey(t.date)))
    if (months.size < 2) continue

    const amounts = txs.map((t) => Number(t.amount))
    const med = median(amounts)
    if (med <= 0) continue

    const consistent = txs.filter((t) => Math.abs(Number(t.amount) - med) / med <= 0.2)
    if (consistent.length < 2) continue

    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date))
    results.push({
      vendorKey: key,
      displayName: sorted[sorted.length - 1].description,
      monthlyEstimate: med,
      occurrences: txs.length,
      monthCount: months.size,
      lastDate: sorted[sorted.length - 1].date,
    })
  }

  return results.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate)
}
