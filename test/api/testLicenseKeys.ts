import test from "ava";
import { rolo } from "./setup.js";
import { faker } from "@faker-js/faker";
import { PortableKeyPair } from "../../src/keyPair.js";

export const testAquaticPrimeKeyPair: PortableKeyPair = {
  publicKey:
    "BD199F701AB2982D6A38EC07B1AC95B6B5E10AD1692A655496AC8C70DCE086B0909ACA1A8462DBC8E906BD883770EC4D262FBC0FA6C369F39DBC167718F73EE0969CC6EEE7517F1DD5BCC80AB0030ADC0D3A82F8F3B803767EDEF87B616B6D94854DAA5A7D59A73B1F01EC0D15D50BD6D8D5A4A596EE63A88ED1F07450B22C89",
  privateKey:
    "7E1114F56721BAC8F17B4805211DB9247940B1E0F0C6EE386473084B3DEB0475B5BC86BC5841E7DB46047E5ACFA09D88C41FD2B519D79BF7BE7D644F65FA29E9E9AFDC9AF918D1870264F8CCDDD1BEF46359582C3A18BC5E138121D6C9FF60AFBCA679F165B826D27A778348A11CBDF66F91651F91FE52B0EC7BA9B590266E63",
  keyFormat: "hex",
  object: "keyPair",
};

const testLicenseData = {
  product: "com.example.product",
  name: "John Doe",
  email: "johndoe123@example.com",
  order: "111111-222222",
  quantity: 2,
  date: new Date("2020-01-01"),
  description: "desc",
  origin: "origin",
};

const testLicenseFileName = "John_Doe.examplelicense";

const testLicenseKey = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Date</key>
	<string>2020-01-01</string>
	<key>Email</key>
	<string>johndoe123@example.com</string>
	<key>Name</key>
	<string>John Doe</string>
	<key>Order</key>
	<string>111111-222222 (origin)</string>
	<key>Product</key>
	<string>com.example.product/desc</string>
	<key>Quantity</key>
	<string>2</string>
	<key>Signature</key>
	<data>FJqfq9aaBnpYovGh0mCz6+zhtFw13Xmli1avXR743NTaCQtEvgpdEPaSta1OfmRHUV24Aq/lq+MR/NbuD3djiCsul+iftwVjZhe2OaSxqhGoEpb/ZWwlNnpV7VNc0rnP+szvL/HHmHC/oQj5tED3tqxwV72Vd1j810QCrAP8fBE=</data>
</dict>
</plist>`;

// test full license file generation
test("create registry for example product", async (t) => {
  // first find and delete the existing registry if it exists
  const res0 = await rolo().get("registries/byIdentifier/com.example.product");
  if (res0.status === 200) {
    const res1 = await rolo().delete(`registries/${res0.data.id}`);
    t.is(res1.status, 204);
  }

  // first we create a registry
  const res = await rolo().post("registries", {
    description: "example product registry",
    identifiers: ["com.example.product"],
    objects: {
      aquaticPrimeKeyPair: testAquaticPrimeKeyPair,
      config: {
        object: "productConfig",
        productName: "Example Product",
        licenseFileExtension: "examplelicense",
      },
    },
  });
  t.log(res.status);
  t.is(res.status, 201);
  t.is(res.headers.location, `/registries/${res.data.id}`);
});

test("create license key, missing payload", async (t) => {
  const res = await rolo().post("licenseKeys", "");
  t.is(res.status, 400);
});

test("create license key, no scope", async (t) => {
  const res = await rolo("noscope").post("licenseKeys", {
    product: "product",
    name: "name",
  });
  t.is(res.status, 403);
});

test("create license key, missing product", async (t) => {
  const res = await rolo().post("licenseKeys", {
    name: "name",
  });
  t.is(res.status, 400);
});

test("create license key, invalid product", async (t) => {
  const res = await rolo().post("licenseKeys", {
    product: "foo-invalid",
    name: "name",
  });
  t.is(res.status, 400);
});

test("create license key, missing name", async (t) => {
  const res = await rolo().post("licenseKeys", {
    product: "com.example.product",
  });
  t.is(res.status, 400);
});

test("create license key", async (t) => {
  const res = await rolo().post("licenseKeys", {
    product: "com.example.product",
    name: "name",
  });
  t.is(res.status, 201);
  t.like(res.data, {
    product: "com.example.product",
    name: "name",
  });
  t.is(res.headers.location, `/licenseKeys/${res.data.id}`);
});

test("create license key, with email, date, order and quantity fields", async (t) => {
  faker.locale = "ru";
  const res = await rolo().post("licenseKeys", {
    product: "com.example.product",
    name: faker.name.fullName(),
    email: faker.internet.email(),
    order: "111111-222222",
    quantity: 1,
  });
  t.is(res.status, 201);
  t.is(res.headers.location, `/licenseKeys/${res.data.id}`);

  const res2 = await rolo().get(`licenseKeys/${res.data.id}`);
  t.is(res2.status, 200);
  t.like(res2.data, res.data);
});

test("create license key, download license file", async (t) => {
  // then we create a license key
  const res2 = await rolo().post("licenseKeys", testLicenseData);
  t.is(res2.status, 201);

  // then we download the license file
  const res3 = await rolo().get(`licenseKeys/${res2.data.id}/file`);
  t.is(res3.status, 200);
  t.is(res3.headers["content-type"], "application/octet-stream");
  t.is(
    res3.headers["content-disposition"],
    `attachment; filename="${testLicenseFileName}"`,
  );
  // base64 decode the license file
  t.is(trimLines(res3.data), trimLines(testLicenseKey));
});

// function to return a string with every line trimmed
function trimLines(str: string) {
  return str
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}

// create a license key, download with the link in the response
test("create license key, download license file with link", async (t) => {
  // then we create a license key
  const res2 = await rolo().post("licenseKeys", testLicenseData);
  t.is(res2.status, 201);
  t.log("download link:", res2.data.file.url);
  t.assert(res2.data.file.url.startsWith("/licenseKeys/"));

  // then we download the license file
  const res3 = await rolo().get(res2.data.file.url, {
    headers: {
      Authorization: null,
    },
  });
  t.is(res3.status, 200);
  t.is(res3.headers["content-type"], "application/octet-stream");
  t.is(
    res3.headers["content-disposition"],
    `attachment; filename="${testLicenseFileName}"`,
  );
  // base64 decode the license file
  t.is(trimLines(res3.data), trimLines(testLicenseKey));
});

test.only("create license key with chinese characters", async (t) => {
  const res = await rolo().post("licenseKeys", {
    product: "com.example.product",
    name: "张三",
  });
  t.is(res.status, 201);
  t.like(res.data, {
    product: "com.example.product",
    name: "张三",
  });
  t.is(res.headers.location, `/licenseKeys/${res.data.id}`);

  // then we download the license file
  const res3 = await rolo().get(res.data.file.url, {
    headers: {
      Authorization: null,
    },
  });
  t.is(res3.status, 200);
  t.is(res3.headers["content-type"], "application/octet-stream");
  t.is(
    res3.headers["content-disposition"],
    `attachment; filename="??.examplelicense"; filename*=UTF-8''%E5%BC%A0%E4%B8%89.examplelicense`,
  );
});
