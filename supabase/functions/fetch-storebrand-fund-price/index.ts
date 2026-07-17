// Henter siste fondskurs fra Storebrands åpne, men udokumenterte fund-data-API.
// Best-effort: dette er ikke et offisielt tredjeparts-API og kan slutte å
// fungere uten varsel (endret PDF-format, fjernet endepunkt, osv.) — frontend
// må alltid falle tilbake til manuell registrering når dette feiler.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { isin } = (await req.json()) as { isin?: string }
    if (!isin || !/^[A-Z0-9]{8,14}$/i.test(isin)) throw new Error('Ugyldig ISIN')

    const docUrl = `https://api.fund.storebrand.no/open/funddata/document?documentType=FUND_PROFILE&isin=${encodeURIComponent(isin)}&languageCode=no&market=NOR`
    const pdfResponse = await fetch(docUrl)
    if (!pdfResponse.ok) throw new Error(`Storebrand svarte med status ${pdfResponse.status}`)
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer())

    // Dynamisk import inne i try/catch: hvis pdf-parse-pakken feiler å laste
    // (kjent til å ha finnicky oppførsel i enkelte serverless-miljøer), skal
    // det gi en ren feilrespons — ikke krasje hele funksjonen ved kaldstart.
    const { default: pdfParse } = await import('npm:pdf-parse@1.1.1')
    const parsed = await pdfParse(pdfBytes)
    const text = parsed.text.replace(/\s+/g, ' ')

    const match = text.match(/NAV\s*\/?\s*Kurs\s*\(?(\d{2}\.\d{2}\.\d{4})\)?\s*NOK\s*([\d\s.,]+)/i)
    if (!match) throw new Error('Fant ikke kurs i dokumentet — formatet kan ha endret seg')

    const priceDate = match[1].split('.').reverse().join('-')
    const price = parseFloat(match[2].trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(price) || price <= 0) throw new Error('Kunne ikke tolke kursverdien')

    return new Response(JSON.stringify({ price, priceDate }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukjent feil'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
