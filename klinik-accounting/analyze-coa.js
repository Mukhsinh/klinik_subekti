import fs from 'fs'

const rawCsv = fs.readFileSync('public/chart_of_accounts_rows (2).csv', 'utf8')
const fixedCsv = fs.readFileSync('public/chart_of_accounts_fixed.csv', 'utf8')

const rawLines = rawCsv.trim().split('\n').slice(1)
const fixedLines = fixedCsv.trim().split('\n').slice(1)

const rawNames = rawLines.map(l => {
    const parts = l.split(';')
    return parts[1] ? parts[1].trim() : ''
}).filter(Boolean)

const fixedNamesSet = new Set(fixedLines.map(l => l.split(',')[1].trim()))

console.log('Total names in raw CSV:', rawNames.length)
console.log('Total unique names in fixed CSV:', fixedNamesSet.size)

const missingInFixed = []
rawNames.forEach(name => {
    // normalize check
    const normName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    let found = false
    for (const fn of fixedNamesSet) {
        if (fn.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normName) || normName.includes(fn.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
            found = true
            break
        }
    }
    if (!found) {
        missingInFixed.push(name)
    }
})

console.log('Names in raw CSV not matching fixed CSV:', missingInFixed.length)
console.log('Sample missing names:', missingInFixed)
