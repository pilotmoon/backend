import {
  ExtensionAppInfo,
  ExtensionFileList,
} from "../../common/extensionSchemas.js";
import { extractDefaultString } from "../../common/saneSchemas.js";
import { ExtensionRecord } from "../controllers/extensionsProcessor.js";
import { AppContext } from "../koaWrapper.js";
import { thash } from "./extensionView.js";
import sanitizeHtml from "sanitize-html";

function linkifyDescription(description: string, apps: ExtensionAppInfo[]) {
  let html = description;
  for (const app of apps) {
    html = description.replace(
      new RegExp(`\\b${app.name}\\b`),
      `<a href="${app.link}">${app.name}</a>`,
    );
  }
  return html;
}

// either bare e.g. readme.md or suffixed e.g. blah-demo.mp4
// and only in root folder
function findSpecialFile(suffix: string, files: ExtensionFileList) {
  const regex = new RegExp(`(^([^/]+-)?${suffix}$)`, "i");
  const file = files.find((f) => regex.test(f.path));
  return file?.hash ?? null;
}

export function makeRss(ctx: AppContext, documents: ExtensionRecord[]) {
  const parts: string[] = [];
  const publicRoot = "https://public.popclip.app";
  const webUrl = "https://www.popclip.app/extensions/";
  parts.push(
    `
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>PopClip Extensions</title>
<link>${webUrl}</link>
<atom:link href="${publicRoot}/extensions/popclip.rss" rel="self" type="application/rss+xml" />
<description>A feed of extensions published to the PopClip Extensions Directory.</description>
<language>en</language>`.trim(),
  );

  for (const ext of documents) {
    const title = extractDefaultString(ext.info.name);
    let description = sanitizeHtml(
      linkifyDescription(
        extractDefaultString(ext.info.description),
        ext.info.apps ?? [],
      ),
    );

    const mp4Hash = findSpecialFile("demo.mp4", ext.files);
    const gifHash = findSpecialFile("demo.gif", ext.files);

    if (mp4Hash) {
      description += `<br><video src="${publicRoot}/blobs/${thash(
        mp4Hash,
      )}/file.mp4" alt="Demo Video" autoplay loop playsinline>Browser can't show this video.</video>`;
    } else if (gifHash) {
      description += `<br><img src="${publicRoot}/blobs/${thash(
        gifHash,
      )}/file.gif" alt="Demo GIF" >`;
    }

    const perma = `${webUrl}x/${ext.shortcode}`;
    const datestr = (ext.firstCreated ?? new Date(0)).toUTCString();

    parts.push(
      `
<item>
    <title>${sanitizeHtml(title)}</title>
    <guid isPermaLink="false">${ext.info.identifier}</guid>
    <description><![CDATA[<p>${description}</p>]]></description>
    <link>${perma}</link>
    <pubDate>${datestr}</pubDate>
</item>`.trim(),
    );
  }

  parts.push("</channel>\n</rss>");

  ctx.body = parts.join("\n");
  ctx.set("Content-Type", "application/rss+xml");
}
