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

for (let [name, alpha2] of Object.entries(paddleCountries)) {
    //console.log(name, alpha2);

    // if alpha2 is in blanks, remap to alpha2 in blanks
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
    const ppp = pppTable.find((row) => row["Country Code"] === isoCountry.alpha3);
    if (!ppp) {
        console.error(`No PPP for ${alpha2} ${isoCountry.alpha3} ${name} [${isoCountry.sovreignty}]`);
        continue;
    }    

    // output
    // console.log(`${alpha2} ${isoCountry.alpha3} ${name} [${isoCountry.sovreignty}] ${ppp["2022"]}`);
    result[alpha2] = {
        name: name,
        alpha3: isoCountry.alpha3,        
        ppp: Number(ppp["2022"]),
    };
}

// sort the keys
const sorted = {};
Object.keys(result).sort().forEach((key) => {
    sorted[key] = result[key];
});
console.log(JSON.stringify(sorted, null, 2));

