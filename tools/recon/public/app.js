// Manifund recon tool UI — vanilla JS, no build step.
let S = { bankTxns: [], matches: [], platformTxns: [], snapshots: [], platformFetchedAt: null }
let tab = 'matching'
let selBank = new Set()
let selPlat = new Set()
let suggested = [] // ranked platform txn ids for the selected bank row
let filters = { bankSource: '', bankCat: '', bankText: '', platText: '', hideSmall: false }

const $ = (sel) => document.querySelector(sel)
const main = $('#main')
const fmt = (n) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })
const fmt0 = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US')
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const SOURCES = {
  mercury_grants: 'Mercury Grants',
  mercury_mox: 'Mercury Mox',
  mercury_other: 'Mercury (off-sheet)',
  stripe_manifund: 'Stripe Manifund',
  stripe_mox: 'Stripe Mox',
  coinbase: 'Coinbase',
  other: 'Other',
}
const COUNTED = [
  'mercury_grants',
  'mercury_mox',
  'stripe_manifund',
  'stripe_mox',
  'coinbase',
  'other',
]
const BANK_CATEGORIES = [
  'internal_transfer',
  'stripe_payout',
  'loan_repayment',
  'payroll',
  'rent',
  'cleaning',
  'card_autopay',
  'wire_fee',
  'direct_grant',
  'ops',
  'other_expenses',
  'revenue_fiscal_sponsorship',
  'revenue_coinbase_yield',
  'revenue_private_offices',
  'revenue_fellowships',
  'revenue_mox_donations',
  'revenue_stripe',
  'revenue_other',
  'other',
]
// revenue sub-buckets roll up into total revenue; legacy 'revenue' rows show as Other revenue
const REVENUE_LABELS = {
  revenue_fiscal_sponsorship: 'Fiscal sponsorship fees',
  revenue_coinbase_yield: 'Coinbase yield',
  revenue_private_offices: 'Private offices',
  revenue_fellowships: 'Fellowships',
  revenue_mox_donations: 'Mox donations',
  revenue_stripe: 'Stripe payments',
  revenue_other: 'Other revenue',
  revenue: 'Other revenue',
}
const NC_CATEGORIES = [
  'pass_through_grant',
  'direct_grant',
  'investor_pass_through',
  'ops',
  'loan_repayment',
  'other',
]
const OFFPLAT = ['paypal', 'usdc', 'regrantor_pot', 'other']

async function api(path, body) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

function status(msg, isErr) {
  $('#status').textContent = msg
  $('#status').style.color = isErr ? '#b91c1c' : '#718096'
}

async function loadState() {
  S = await api('/api/state')
  render()
}

function windowRange() {
  return [$('#win-start').value, $('#win-end').value]
}

function matchedBankIds() {
  return new Set(S.matches.flatMap((m) => m.bankTxnIds))
}
function matchedPlatIds() {
  return new Set(S.matches.flatMap((m) => m.platformTxnIds))
}

// ---------- rendering ----------

function render() {
  document
    .querySelectorAll('#tabs button')
    .forEach((b) => b.classList.toggle('active', b.dataset.tab === tab))
  if (tab === 'import') renderImport()
  else if (tab === 'matching') renderMatching()
  else renderOverview()
}

// ---------- import ----------

function renderImport() {
  const counts = {}
  for (const t of S.bankTxns) counts[t.source] = (counts[t.source] || 0) + 1
  main.innerHTML = `
    <div class="drop" id="drop">Drop CSV exports here (Mercury, Stripe unified_payments, Coinbase) or
      <input type="file" id="file" multiple accept=".csv" /></div>
    <div class="section">
      <button class="action" id="automatch">Run auto-match</button>
      <button class="action secondary" id="refresh">Refresh platform txns</button>
      <span class="muted">platform cache: ${S.platformTxns.length} txns${S.platformFetchedAt ? ' fetched ' + S.platformFetchedAt.slice(0, 16).replace('T', ' ') : ''}</span>
    </div>
    <div class="section"><h2>Imported bank txns</h2>
      ${
        Object.entries(counts)
          .map(([s, n]) => `<span class="badge">${SOURCES[s] || s}: ${n}</span> `)
          .join('') || '<span class="muted">none yet</span>'
      }
    </div>
    <div class="section"><h2>Add manual bank txn</h2>
      <div class="muted">For money movements not in any CSV (e.g. investment returns arriving in an unimported account).</div>
      <select id="mt-source">${Object.entries(SOURCES)
        .map(([k, v]) => `<option value="${k}">${v}</option>`)
        .join('')}</select>
      <input type="date" id="mt-date" />
      <input type="number" step="0.01" id="mt-amount" placeholder="amount (+ in / − out)" />
      <input type="text" id="mt-desc" placeholder="description" />
      <button class="action" id="mt-add">Add</button>
    </div>
    <div class="section" id="import-log"></div>`

  const log = (html) => ($('#import-log').innerHTML += html + '<br/>')
  const handleFiles = async (files) => {
    for (const file of files) {
      const csv = await file.text()
      try {
        let res = await api('/api/import', { csv, filename: file.name })
        if (res.needsMapping) {
          log(`<b>${esc(file.name)}</b>: unknown format — pick columns:`)
          const sel = (id) =>
            `<select id="${id}">${res.headers.map((h) => `<option>${esc(h)}</option>`).join('')}</select>`
          $('#import-log').innerHTML +=
            `<div id="map-ui">date ${sel('m-date')} amount ${sel('m-amount')} description ${sel('m-desc')} id (optional) <select id="m-id"><option value="">—</option>${res.headers.map((h) => `<option>${esc(h)}</option>`).join('')}</select>
            <button class="action" id="m-go">Import with mapping</button></div>`
          $('#m-go').onclick = async () => {
            const mapping = {
              dateCol: $('#m-date').value,
              amountCol: $('#m-amount').value,
              descriptionCol: $('#m-desc').value,
              idCol: $('#m-id').value || undefined,
            }
            const r2 = await api('/api/import', { csv, mapping })
            log(importSummary(file.name, r2))
            loadState()
          }
        } else {
          log(importSummary(file.name, res))
        }
      } catch (e) {
        log(`<span class="warn">${esc(file.name)}: ${esc(e.message)}</span>`)
      }
    }
    const s2 = await api('/api/state')
    S = s2
    // keep the log; just update counts line lazily on next tab switch
  }
  const importSummary = (name, r) =>
    `<b>${esc(name)}</b> (${r.format}): +${r.inserted} new, ${r.skipped} duplicate, ${r.updated || 0} updated, ${r.dropped} dropped (pending/failed) · ${Object.entries(
      r.sourceCounts
    )
      .map(([s, n]) => `${SOURCES[s] || s} ${n}`)
      .join(', ')}${r.dateRange ? ` · ${r.dateRange[0]} → ${r.dateRange[1]}` : ''}`

  $('#mt-add').onclick = async () => {
    const body = {
      source: $('#mt-source').value,
      date: $('#mt-date').value,
      amount: parseFloat($('#mt-amount').value),
      description: $('#mt-desc').value,
    }
    if (!body.date || !body.amount || !body.description)
      return status('date, amount and description required', true)
    await api('/api/add-txn', body)
    status(`added manual txn: ${body.description} ${fmt(body.amount)}`)
    await loadState()
  }
  $('#file').onchange = (e) => handleFiles([...e.target.files])
  const drop = $('#drop')
  drop.ondragover = (e) => {
    e.preventDefault()
    drop.classList.add('over')
  }
  drop.ondragleave = () => drop.classList.remove('over')
  drop.ondrop = (e) => {
    e.preventDefault()
    drop.classList.remove('over')
    handleFiles([...e.dataTransfer.files])
  }
  $('#automatch').onclick = async () => {
    status('auto-matching…')
    const r = await api('/api/auto-match', {})
    status(
      `auto-match: ${r.newMatches} new matches (${Object.entries(r.phaseCounts)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')})`
    )
    await loadState()
  }
  $('#refresh').onclick = async () => {
    status('fetching platform txns…')
    const r = await api('/api/refresh-platform', {})
    status(`platform cache refreshed: ${r.count} txns`)
    await loadState()
  }
}

// ---------- matching ----------

function renderMatching() {
  const mb = matchedBankIds()
  const mp = matchedPlatIds()
  const [ws, we] = windowRange()
  const inWin = (d) => (!ws || d >= ws) && (!we || d <= we)

  let bank = S.bankTxns.filter((t) => !t.matchId && !mb.has(t.id) && inWin(t.date))
  if (filters.bankSource) bank = bank.filter((t) => t.source === filters.bankSource)
  // categorized rows are considered accounted for and hidden by default — except unpaired
  // internal transfers, which usually still need matching (e.g. pass-throughs to Frame/Surplus)
  if (!filters.bankCat) bank = bank.filter((t) => !t.category || t.category === 'internal_transfer')
  else if (filters.bankCat !== '__all') bank = bank.filter((t) => t.category === filters.bankCat)
  if (filters.bankText)
    bank = bank.filter((t) =>
      (t.description + ' ' + (t.counterparty || ''))
        .toLowerCase()
        .includes(filters.bankText.toLowerCase())
    )
  if (filters.hideSmall) bank = bank.filter((t) => Math.abs(t.amount) >= 100)
  bank.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  let plat = S.platformTxns.filter((t) => !mp.has(t.id) && inWin(t.created_at.slice(0, 10)))
  if (filters.platText)
    plat = plat.filter((t) =>
      (t.username + ' ' + t.fullName + ' ' + t.email)
        .toLowerCase()
        .includes(filters.platText.toLowerCase())
    )
  if (filters.hideSmall) plat = plat.filter((t) => t.amount >= 100)
  if (suggested.length) {
    const rank = new Map(suggested.map((id, i) => [id, i]))
    plat.sort(
      (a, b) =>
        (rank.has(a.id) ? rank.get(a.id) : 1e9) - (rank.has(b.id) ? rank.get(b.id) : 1e9) ||
        b.amount - a.amount
    )
  } else plat.sort((a, b) => b.amount - a.amount)

  const CAP = 400
  const matchGroups = S.matches
    .filter(
      (m) =>
        m.bankTxnIds.some((id) => {
          const t = S.bankTxns.find((x) => x.id === id)
          return t && inWin(t.date)
        }) ||
        m.platformTxnIds.some((id) => {
          const t = S.platformTxns.find((x) => x.id === id)
          return t && inWin(t.created_at.slice(0, 10))
        })
    )
    .slice()
    .reverse()

  main.innerHTML = `
    <div class="panes">
      <div class="pane">
        <h2>Unmatched bank txns (${bank.length}${bank.length > CAP ? `, showing ${CAP}` : ''})</h2>
        <div class="filters">
          <select id="f-source"><option value="">all accounts</option>${Object.entries(SOURCES)
            .map(
              ([k, v]) =>
                `<option value="${k}" ${filters.bankSource === k ? 'selected' : ''}>${v}</option>`
            )
            .join('')}</select>
          <select id="f-cat"><option value="">untagged + transfers</option><option value="__all" ${filters.bankCat === '__all' ? 'selected' : ''}>all (incl. tagged)</option>${BANK_CATEGORIES.map((c) => `<option ${filters.bankCat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
          <input type="text" id="f-btext" placeholder="search" value="${esc(filters.bankText)}" />
          <label><input type="checkbox" id="f-small" ${filters.hideSmall ? 'checked' : ''}/> hide &lt;$100</label>
        </div>
        <div class="tbl-wrap"><table>
          <tr><th></th><th>date</th><th>account</th><th class="num">amount</th><th>description</th><th>category</th></tr>
          ${bank
            .slice(0, CAP)
            .map(
              (t) => `
            <tr><td><input type="checkbox" data-bank="${t.id}" ${selBank.has(t.id) ? 'checked' : ''}/></td>
              <td>${t.date}</td><td>${SOURCES[t.source]}</td>
              <td class="num ${t.amount < 0 ? 'neg' : 'pos'}">${fmt(t.amount)}</td>
              <td class="desc" title="${esc(t.description)}">${esc(t.description)}</td>
              <td>${t.category ? `<span class="badge cat">${t.category}${t.categorySource === 'auto' ? '·a' : ''}</span>` : ''}</td></tr>`
            )
            .join('')}
        </table></div>
      </div>
      <div class="pane">
        <h2>Unmatched platform txns (${plat.length}${plat.length > CAP ? `, showing ${CAP}` : ''})</h2>
        <div class="filters">
          <input type="text" id="f-ptext" placeholder="search user" value="${esc(filters.platText)}" />
          ${suggested.length ? '<span class="badge auto">sorted by match suggestions</span>' : ''}
        </div>
        <div class="tbl-wrap"><table>
          <tr><th></th><th>date</th><th>type</th><th class="num">amount</th><th>user</th></tr>
          ${plat
            .slice(0, CAP)
            .map(
              (t) => `
            <tr class="${suggested.includes(t.id) ? 'suggested' : ''}"><td><input type="checkbox" data-plat="${t.id}" ${selPlat.has(t.id) ? 'checked' : ''}/></td>
              <td>${t.created_at.slice(0, 10)}</td><td>${t.type}</td>
              <td class="num">${fmt(t.amount)}</td>
              <td class="desc">${esc(t.username)} <span class="muted">${esc(t.fullName)}</span></td></tr>`
            )
            .join('')}
        </table></div>
      </div>
    </div>
    <div class="section" style="margin-top:12px"><h2>Match groups in window (${matchGroups.length})</h2>
      <div class="tbl-wrap"><table>
        ${matchGroups
          .slice(0, 200)
          .map((m) => {
            const bts = m.bankTxnIds
              .map((id) => S.bankTxns.find((t) => t.id === id))
              .filter(Boolean)
            const pts = m.platformTxnIds
              .map((id) => S.platformTxns.find((t) => t.id === id))
              .filter(Boolean)
            return `<tr>
            <td><span class="badge ${m.kind}">${m.kind}</span>${m.category ? ` <span class="badge cat">${m.category}</span>` : ''}${m.revenueRemainder ? ` <span class="badge auto">+${fmt0(m.revenueRemainder)} revenue</span>` : ''}${m.uncreditedRemainder ? ` <span class="badge auto">${fmt0(m.uncreditedRemainder)} uncredited</span>` : ''}</td>
            <td class="desc" title="${esc(bts.map((t) => t.description).join(' + '))}">${bts.map((t) => `${t.date} ${fmt(t.amount)} ${esc(t.description.slice(0, 40))}`).join('<br/>') || '<span class="muted">—</span>'}</td>
            <td>${pts.map((t) => `${t.created_at.slice(0, 10)} ${fmt(t.amount)} ${esc(t.username)}`).join('<br/>') || '<span class="muted">—</span>'}</td>
            <td class="desc note-cell" data-editnote="${m.id}" title="click to edit note">${esc(m.note || '') || '<span class="muted">+ note</span>'}</td>
            <td><button class="action secondary" data-unmatch="${m.id}">Unmatch</button></td></tr>`
          })
          .join('')}
      </table></div>
    </div>
    <div id="matchbar">
      <span class="sums" id="sums"></span>
      <span id="bar-hint" class="muted"></span>
      <span id="grp-match"><input type="text" id="m-note" placeholder="note (optional)" /><input type="number" id="m-uncredited" placeholder="uncredited $" title="Part of the bank inflow received for a platform account that does not exist yet; booked as a pending liability" style="width:9em" />
        <button class="action" id="do-match" title="Link the selected bank row(s) and platform row(s) as one payment">Match</button>
        <button class="action secondary" id="do-match-rev" title="Link them, and record the leftover bank amount as Manifund revenue"></button></span>
      <span id="grp-nc"><select id="nc-cat" title="Why this bank row has no platform transaction">${NC_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select>
        <button class="action secondary" id="do-nc" title="This money never touched a Manifund user balance (e.g. a grant wired directly to an org)">No platform counterpart</button></span>
      <span id="grp-op"><select id="op-cat">${OFFPLAT.map((c) => `<option>${c}</option>`).join('')}</select>
        <button class="action secondary" id="do-op" title="This platform withdrawal/deposit was settled outside the imported accounts (PayPal, USDC...)">Paid off-platform</button></span>
      <span id="grp-cat"><select id="set-cat" title="Tag spending/revenue that never involves the platform (rent, payroll...)"><option value="">tag category…</option>${BANK_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}<option value="__clear">clear tag</option></select></span>
      <button class="action secondary" id="clear-sel">Clear</button>
    </div>`

  const updateSums = () => {
    const bNet = [...selBank].reduce(
      (s, id) => s + (S.bankTxns.find((t) => t.id === id)?.amount ?? 0),
      0
    )
    const pNet = [...selPlat].reduce((s, id) => {
      const p = S.platformTxns.find((t) => t.id === id)
      return s + (p ? (p.type === 'deposit' ? p.amount : -p.amount) : 0)
    }, 0)
    const nb = selBank.size,
      np = selPlat.size
    $('#sums').textContent =
      !nb && np
        ? `platform ${np} · deposits − withdrawals = ${fmt(pNet)}`
        : `bank ${nb} = ${fmt(bNet)} · platform net ${np} = ${fmt(pNet)} · Δ ${fmt(bNet - pNet)}`
    // show only the actions that make sense for the current selection
    const show = (id, on) => ($(id).style.display = on ? '' : 'none')
    show('#grp-match', (nb && np) || nb >= 2 || np >= 2)
    const delta = bNet - pNet
    const platOnlyRev = !nb && np >= 2 && pNet < -1 // withdrawals exceed deposits: remainder stayed with Manifund
    show('#do-match-rev', (nb > 0 && np > 0 && delta > 1) || platOnlyRev)
    if (nb && np && delta > 1) $('#do-match-rev').textContent = `Match, ${fmt0(delta)} → revenue`
    else if (platOnlyRev) $('#do-match-rev').textContent = `Match, ${fmt0(-pNet)} → revenue`
    show('#grp-nc', nb > 0 && !np)
    show('#grp-op', np > 0 && !nb)
    show('#grp-cat', nb > 0 && !np)
    $('#bar-hint').textContent =
      !nb && !np
        ? 'Select rows: bank + platform → Match. Bank only → tag or mark. Platform only → match cancelling deposit↔withdrawal, or paid off-platform.'
        : nb && np
          ? 'Match links these as one payment.'
          : nb >= 2
            ? 'Match pairs bank rows that cancel out (in → forwarded out), or tag/mark them below.'
            : nb
              ? 'Pick the matching platform row on the right (best guesses highlighted), or tag/mark this row. A ~5% overage is usually the donation fee — use "Match, Δ → revenue".'
              : np >= 2
                ? 'Match pairs a deposit ↔ withdrawal that cancel (same user, no bank movement) — or mark them paid off-platform.'
                : 'This platform txn was settled outside the imported bank accounts? Mark it paid off-platform.'
  }
  updateSums()

  $('#f-source').onchange = (e) => {
    filters.bankSource = e.target.value
    render()
  }
  $('#f-cat').onchange = (e) => {
    filters.bankCat = e.target.value
    render()
  }
  $('#f-btext').onchange = (e) => {
    filters.bankText = e.target.value
    render()
  }
  $('#f-ptext').onchange = (e) => {
    filters.platText = e.target.value
    render()
  }
  $('#f-small').onchange = (e) => {
    filters.hideSmall = e.target.checked
    render()
  }

  main.querySelectorAll('input[data-bank]').forEach((cb) => {
    cb.onchange = async () => {
      cb.checked ? selBank.add(cb.dataset.bank) : selBank.delete(cb.dataset.bank)
      if (selBank.size === 1) {
        const r = await api('/api/suggest', { bankTxnId: [...selBank][0] })
        suggested = r.suggestions
        render()
      } else updateSums()
    }
  })
  main.querySelectorAll('input[data-plat]').forEach((cb) => {
    cb.onchange = () => {
      cb.checked ? selPlat.add(cb.dataset.plat) : selPlat.delete(cb.dataset.plat)
      updateSums()
    }
  })
  main.querySelectorAll('button[data-unmatch]').forEach((b) => {
    b.onclick = async () => {
      await api('/api/unmatch', { matchId: b.dataset.unmatch })
      await loadState()
    }
  })
  main.querySelectorAll('td[data-editnote]').forEach((cell) => {
    cell.onclick = () => {
      if (cell.querySelector('input')) return
      const id = cell.dataset.editnote
      const current = (S.matches.find((m) => m.id === id) || {}).note || ''
      cell.innerHTML = ''
      const input = document.createElement('input')
      input.type = 'text'
      input.value = current
      input.style.width = '95%'
      cell.appendChild(input)
      input.focus()
      const save = async () => {
        await api('/api/update-note', { matchId: id, note: input.value.trim() })
        await loadState()
      }
      input.onkeydown = (e) => {
        if (e.key === 'Enter') save()
        if (e.key === 'Escape') loadState()
      }
      input.onblur = save
    }
  })

  const clearSel = () => {
    selBank.clear()
    selPlat.clear()
    suggested = []
  }
  $('#clear-sel').onclick = () => {
    clearSel()
    render()
  }

  const doMatch = async (kind, category, platformIds, remainderToRevenue) => {
    try {
      await api('/api/match', {
        bankTxnIds: [...selBank],
        platformTxnIds: platformIds,
        kind,
        category,
        note: $('#m-note').value || undefined,
        remainderToRevenue,
        uncredited: Number($('#m-uncredited').value) || undefined,
      })
      clearSel()
      await loadState()
      status('matched')
    } catch (e) {
      if (
        (e.message.includes('mismatch') || e.message.includes('do not cancel out')) &&
        confirm(e.message + '\n\nForce match anyway?')
      ) {
        await api('/api/match', {
          bankTxnIds: [...selBank],
          platformTxnIds: platformIds,
          kind,
          category,
          note: $('#m-note').value || undefined,
          uncredited: Number($('#m-uncredited').value) || undefined,
          force: true,
        })
        clearSel()
        await loadState()
        status('matched (forced)')
      } else status(e.message, true)
    }
  }
  $('#do-match').onclick = () => {
    const nb = selBank.size,
      np = selPlat.size
    const uncredited = Number($('#m-uncredited').value) > 0
    if (!((nb && np) || nb >= 2 || np >= 2 || (nb === 1 && uncredited)))
      return status(
        'select bank+platform rows, ≥2 bank rows, or ≥2 platform rows that cancel',
        true
      )
    doMatch('manual', undefined, [...selPlat])
  }
  $('#do-match-rev').onclick = () => {
    if (!selBank.size || !selPlat.size) return status('select rows on both sides', true)
    doMatch('manual', undefined, [...selPlat], true)
  }
  $('#do-nc').onclick = () => {
    if (!selBank.size) return status('select bank rows', true)
    doMatch('no_counterpart', $('#nc-cat').value, [])
  }
  $('#do-op').onclick = async () => {
    if (!selPlat.size) return status('select platform rows', true)
    try {
      await api('/api/match', {
        bankTxnIds: [],
        platformTxnIds: [...selPlat],
        kind: 'offplatform_payment',
        category: $('#op-cat').value,
        note: $('#m-note').value || undefined,
      })
      clearSel()
      await loadState()
    } catch (e) {
      status(e.message, true)
    }
  }
  $('#set-cat').onchange = async (e) => {
    if (!e.target.value || !selBank.size) return
    await api('/api/category', {
      bankTxnIds: [...selBank],
      category: e.target.value === '__clear' ? '' : e.target.value,
    })
    clearSel()
    await loadState()
  }
}

// ---------- overview ----------

const ORG = {
  mercury_grants: 'manifund',
  stripe_manifund: 'manifund',
  coinbase: 'manifund',
  other: 'manifund',
  mercury_mox: 'mox',
  stripe_mox: 'mox',
}
const CAT_LABELS = {
  payroll: 'Payroll',
  rent: 'Rent',
  cleaning: 'Cleaning',
  card_autopay: 'Credit card autopay',
  other_expenses: 'Other expenses',
  ops: 'Ops',
}

function renderOverview() {
  const [ws, we] = windowRange()
  if (!ws || !we) {
    main.innerHTML = '<div class="section">Set a date window above.</div>'
    return
  }
  const inWin = (d) => d >= ws && d <= we
  const bankById = new Map(S.bankTxns.map((t) => [t.id, t]))
  const mBank = new Map()
  for (const m of S.matches) for (const id of m.bankTxnIds) mBank.set(id, m)
  const mPlat = matchedPlatIds()
  const mb = matchedBankIds()
  const mPlatMatch = new Map()
  for (const m of S.matches) for (const id of m.platformTxnIds) mPlatMatch.set(id, m)

  // one P&L-style table: rows keyed by group+label, columns manifund / mox
  const rows = new Map()
  const add = (group, label, org, v) => {
    const key = group + '|' + label
    if (!rows.has(key)) rows.set(key, { group, label, manifund: 0, mox: 0 })
    rows.get(key)[org] += v
  }
  let residual = 0
  for (const t of S.bankTxns) {
    if (!inWin(t.date)) continue
    const m = mBank.get(t.id)
    const cat = t.category ?? (m && m.category)
    // Mox donations sometimes land in a Manifund account; attribute them to Mox anyway
    const org = cat === 'revenue_mox_donations' ? 'mox' : ORG[t.source]
    if (!org) continue
    if (cat === 'stripe_payout') continue // counterpart is our own Stripe balance
    if (cat === 'loan_repayment') continue // asset swap (loan receivable -> cash), not income
    if (t.fee) add('out', 'Payment processing fees', org, -t.fee)
    if (cat === 'internal_transfer') {
      const partnerId =
        m && m.kind === 'internal_transfer' && m.bankTxnIds.find((id) => id !== t.id)
      const partner = partnerId && bankById.get(partnerId)
      if (partner && ORG[partner.source]) {
        residual += t.amount
        continue
      } // counted<->counted nets out
      add('diff', 'Unexplained diff', org, t.amount) // off-sheet transfer legs — pass-throughs should cancel once matched
      continue
    }
    if (cat === 'other') {
      add(t.amount >= 0 ? 'in' : 'out', 'Other', org, t.amount)
    } else if (t.amount > 0) {
      if (REVENUE_LABELS[cat]) add('in', REVENUE_LABELS[cat], org, t.amount)
      else add('diff', 'Unexplained diff', org, t.amount) // credited or pass-through — should cancel against liability changes
    } else if (t.amount < 0) {
      if (cat === 'direct_grant') add('out', 'Direct grants (no platform txn)', org, t.amount)
      else if (cat === 'wire_fee') add('out', 'Payment processing fees', org, t.amount)
      else if (CAT_LABELS[cat]) add('out', CAT_LABELS[cat], org, t.amount)
      else add('diff', 'Unexplained diff', org, t.amount) // withdrawals paid / uncategorized — should cancel too
    }
  }
  // match-level revenue remainders: shift from the diff bucket into revenue
  for (const m of S.matches) {
    if (!m.revenueRemainder && !m.uncreditedRemainder) continue
    const t = m.bankTxnIds.map((id) => bankById.get(id)).find((x) => x && ORG[x.source])
    if (t && !inWin(t.date)) continue
    if (!t) {
      // platform-only group: check its platform txns are in window
      const p = m.platformTxnIds.map((id) => S.platformTxns.find((x) => x.id === id)).find(Boolean)
      if (!p || !inWin(p.created_at.slice(0, 10))) continue
    }
    const org = t ? ORG[t.source] : 'manifund'
    if (m.revenueRemainder) {
      add('in', REVENUE_LABELS.revenue_fiscal_sponsorship, org, m.revenueRemainder)
      add('diff', 'Unexplained diff', org, -m.revenueRemainder)
    }
    if (m.uncreditedRemainder) {
      // cash for a platform account that does not exist yet: offset by the pending liability on the sheet, so NAV-neutral
      add('diff', 'Unexplained diff', org, -m.uncreditedRemainder)
    }
  }
  // user balance (liability) changes — platform balances are a Manifund liability
  let deposits = 0
  let withdrawals = 0
  const inFlight = []
  for (const p of S.platformTxns) {
    if (!inWin(p.created_at.slice(0, 10))) continue
    // credited from the regrantor pot: liability swap, not a NAV change
    if (mPlatMatch.get(p.id)?.category === 'regrantor_pot') continue
    if (p.type === 'deposit') deposits += p.amount
    else {
      withdrawals += p.amount
      if (!mPlat.has(p.id)) inFlight.push(p)
    }
  }
  if (deposits) add('diff', 'Unexplained diff', 'manifund', -deposits)
  if (withdrawals) add('diff', 'Unexplained diff', 'manifund', withdrawals)

  const entries = [...rows.entries()]
  const total = (r) => r.manifund + r.mox
  const grandM = entries.reduce((s, [, r]) => s + r.manifund, 0)
  const grandX = entries.reduce((s, [, r]) => s + r.mox, 0)
  const grand = grandM + grandX
  const unmatchedDeps = S.platformTxns.filter(
    (p) => p.type === 'deposit' && inWin(p.created_at.slice(0, 10)) && !mPlat.has(p.id)
  )
  const unmatchedDepsSum = unmatchedDeps.reduce((s, p) => s + p.amount, 0)
  const unBank = S.bankTxns.filter(
    (t) => inWin(t.date) && !t.matchId && !mb.has(t.id) && !t.category
  )
  const inFlightSum = inFlight.reduce((s, p) => s + p.amount, 0)
  const month = we.slice(0, 7)
  const prior = [...S.snapshots].reverse().find((s) => s.month < month)
  const cell = (v) =>
    `<td class="num ${v < 0 ? 'neg' : v > 0 ? 'pos' : ''}">${v ? fmt0(v) : ''}</td>`
  const groups = [
    ['Money in', 'in'],
    ['Money out', 'out'],
    ['', 'diff'],
  ]

  main.innerHTML = `
    <div class="overview-grid">
    <div class="section"><h2>Expected NAV change · ${ws} → ${we}</h2>
      <div class="tbl-wrap"><table>
        <tr><th></th><th class="num">Manifund</th><th class="num">Mox</th><th class="num">Total</th></tr>
        ${groups
          .map(([label, g]) => {
            const rs = entries
              .filter(([, r]) => r.group === g)
              .sort((a, b) => Math.abs(total(b[1])) - Math.abs(total(a[1])))
            return rs.length
              ? (label ? `<tr><th>${label}</th><th></th><th></th><th></th></tr>` : '') +
                  rs
                    .map(
                      ([, r]) =>
                        `<tr><td>${r.label}</td>${cell(r.manifund)}${cell(r.mox)}${cell(total(r))}</tr>`
                    )
                    .join('')
              : ''
          })
          .join('')}
        <tr style="border-top:2px solid #cbd5e0"><td><b>Expected ΔNAV</b></td>
          ${[grandM, grandX, grand].map((v) => `<td class="num ${v < 0 ? 'neg' : 'pos'}"><b>${fmt0(v)}</b></td>`).join('')}</tr>
      </table></div>
      <div class="muted" style="margin-top:6px">&quot;Unexplained diff&quot; collapses flows that should cancel once fully reconciled: credited donations vs user balance changes, pass-throughs vs off-sheet transfer legs, withdrawals paid vs balances debited. A large value means matching work (or missing account coverage) remains.</div>
    </div></div>`
}

// ---------- init ----------

document.querySelectorAll('#tabs button').forEach(
  (b) =>
    (b.onclick = () => {
      tab = b.dataset.tab
      render()
    })
)
$('#win-start').onchange = render
$('#win-end').onchange = render
{
  // default window: last full month
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const last = new Date(now.getFullYear(), now.getMonth(), 0)
  $('#win-start').value = first.toISOString().slice(0, 10)
  $('#win-end').value = last.toISOString().slice(0, 10)
}
loadState().catch((e) => status(e.message, true))
