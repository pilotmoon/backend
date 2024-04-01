import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { pad } from 'lodash';

// load ISO codes tsv
const isoTableTsv = readFileSync('iso.tsv');
const isoTable = parse(isoTableTsv, {
  columns: ['name', 'sovreignty', 'alpha2', 'alpha3'],
  skip_empty_lines: true,
  delimiter: '\t',
});
//console.log(isoTable);

// load ppp csv from disk
const pppCsv = readFileSync('ppp.csv');
const pppTable = parse(pppCsv, {
  columns: true,
  skip_empty_lines: true,
});
//console.log(pppTable);

// load paddleCountries.json from disk
const paddleCountries = JSON.parse(readFileSync('paddleCountries.json', 'utf8'));

// load blanks.json from disk
const blanks = JSON.parse(readFileSync('blanks.json', 'utf8'));

const result = {};

for (const [name, rawAlpha2] of Object.entries(paddleCountries)) {
    //console.log(name, alpha2);

    // if alpha2 is in blanks, remap to alpha2 in blanks
    let alpha2 = rawAlpha2;
    if (blanks[alpha2]) {
        console.warn(`Remapping ${alpha2} (${name}) to ${blanks[alpha2]}`);
        alpha2 = blanks[alpha2];
    }

    // look up alpha2 in isoTable
    const isoCountry = isoTable.find((row) => row.alpha2 === alpha2);
    if (!isoCountry) {
        console.error(`Unknown country ${alpha2}`);
        continue;
    }
  
    // look up country in pppTable
    const pppEntry = pppTable.find((row) => row["Country Code"] === isoCountry.alpha3);
    if (!pppEntry) {
        console.error(`No PPP for ${alpha2} ${isoCountry.alpha3} ${name} [${isoCountry.sovreignty}]`);
        continue;
    }    

    // extact ppp; start with 2022 then try 2021, 2020, ... back to 1960
    let pppValue = null;
    for (let year = 2022; year >= 1960; year--) {
      pppValue = pppEntry[year];
      if (pppValue) {
        if (year !== 2022) {
          console.warn(`Using ${year} PPP for ${alpha2} ${isoCountry.alpha3} ${name} [${isoCountry.sovreignty}]`);
        }
        break;
      }
    }
    if (!pppValue) {
        console.error(`No PPP for ${alpha2} ${isoCountry.alpha3} ${name} [${isoCountry.sovreignty}]`);
        continue;
    }

    // output
    // console.log(`${alpha2} ${isoCountry.alpha3} ${name} [${isoCountry.sovreignty}] ${ppp["2022"]}`);
    result[rawAlpha2] = {
        name: name,
        treatedAs: alpha2,
        alpha3: isoCountry.alpha3,        
        ppp: Number(pppValue),
    };
}

// sort the keys
const sorted = {};
Object.keys(result).sort().forEach((key) => {
    sorted[key] = result[key];
});
console.log(JSON.stringify(sorted, null, 2));

// print out a list of countries sotreed form highest to lowest ppp, ppp rounded to 2dp
const sortedByPPP = Object.entries(result).sort((a, b) => b[1].ppp - a[1].ppp);
console.log(sortedByPPP.map(([key, value]) => `${key} ${value.ppp.toFixed(2)} (${value.name})`).join('\n'));
