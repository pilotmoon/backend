// connect to API ising api key
// patch every license key with empty object
// (this forces the hashes array to update)

import axios from "axios";
const apiKey = "";
const api = axios.create(
    {
        baseURL: "http://localhost:1234",
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    }
);

const response = await api.get("/health");
console.log(response.data);

// enumerate all license keys
const limit = 100;
let count=0;
let done = false;
let cursor;
do {
    const response = await api.get("/licenseKeys", {
            params: {
                cursor,
                limit,
            }
        }
    );
    const items = response.data.items;
    for (const item of items) {
        console.log(`item ${count++} is ${item.id}`);

        // patch license key
        const patchResponse = await api.patch(`/licenseKeys/${item.id}`, {});
        console.log(`patch status is ${patchResponse.status}`);

        cursor = item.id;
    }
    done = items.length < limit;
} while(!done);
