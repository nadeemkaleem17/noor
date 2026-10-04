// Roman-Urdu spellings people use for the same word (plan/09-data-model/05-search.md section 2.2). Each group is symmetric: every member
// finds the others. Staff do not edit this in v1; the zero-result list says what to add.

const groups = [
  ['shalwar', 'shalwaar', 'salwar', 'shalwr'],
  ['dupatta', 'dupata', 'dopatta', 'duppata'],
  ['kameez', 'qameez', 'kamiz', 'qamiz'],
  ['kurta', 'kurti', 'kurtha'],
  ['lehnga', 'lehenga', 'lehengha', 'lengha'],
  ['gharara', 'ghararah', 'gharare'],
  ['sharara', 'shararah', 'sharare'],
  ['khussa', 'khusa', 'khussay'],
  ['chappal', 'chapal', 'sandal', 'sandals'],
  ['frock', 'frok', 'frocks'],
  ['pajama', 'pyjama', 'pajamas', 'pyjamas'],
  ['waistcoat', 'wescoat', 'waascoat'],
  ['embroidered', 'embroidary', 'embroidery'],
  ['chiffon', 'shifon', 'chifon'],
  ['velvet', 'valvet', 'velvt'],
  ['bridal', 'dulhan', 'dulhen'],
  ['jora', 'joda', 'jorra'],
  ['maxi', 'maxy'],
  ['abaya', 'abaaya', 'abayah'],
  ['dupatta', 'chunni', 'chunri'],
]

/** @type {{ term: string, expandsTo: string }[]} */
export const synonymSeeds = (() => {
  /** @type {Map<string, Set<string>>} */
  const map = new Map()
  for (const group of groups) {
    for (const term of group) {
      const set = map.get(term) ?? new Set()
      for (const other of group) if (other !== term) set.add(other)
      map.set(term, set)
    }
  }
  return [...map].map(([term, others]) => ({ term, expandsTo: [...others].join(' ') }))
})()
