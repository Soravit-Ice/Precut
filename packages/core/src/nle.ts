import type {
  MediaAsset,
  Region,
  AudioTrack,
} from "../../shared/src/contracts";
import { frames } from "./timeline";
export const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
const fileURL = (path: string) =>
  path.match(/^[A-Za-z]:/)
    ? `file://localhost/${path
        .replace(/\\/g, "/")
        .split("/")
        .map((part, i) => (i === 0 ? part : encodeURIComponent(part)))
        .join("/")}`
    : `file://localhost${path.split("/").map(encodeURIComponent).join("/")}`;
type External = { asset: MediaAsset; track: AudioTrack };
function audioRange(region: Region, external: External) {
  const start = Math.max(region.startUs, external.track.offsetUs),
    end = Math.min(
      region.endUs,
      external.track.offsetUs + external.asset.durationUs,
    );
  return end > start
    ? {
        sourceStart: start - external.track.offsetUs,
        sourceEnd: end - external.track.offsetUs,
        parentStart: start,
        outputStart: region.outputStartUs + start - region.startUs,
        duration: end - start,
      }
    : undefined;
}
export function fcpxml(
  name: string,
  asset: MediaAsset,
  regions: Region[],
  external?: External,
) {
  const n = asset.fps.numerator,
    d = asset.fps.denominator,
    time = (us: number) => `${frames(us, asset.fps) * d}/${n}s`,
    duration = regions.reduce((sum, r) => sum + r.endUs - r.startUs, 0);
  const resources = `<format id="format" name="Precut" frameDuration="${d}/${n}s" width="${asset.width || 1920}" height="${asset.height || 1080}"/><asset id="source" name="${xmlEscape(asset.name)}" start="0s" duration="${time(asset.durationUs)}" hasVideo="${asset.hasVideo ? 1 : 0}" hasAudio="${asset.hasAudio ? 1 : 0}" format="format"><media-rep kind="original-media" src="${xmlEscape(fileURL(asset.path))}"/></asset>${external ? `<asset id="external" name="${xmlEscape(external.asset.name)}" start="0s" duration="${time(external.asset.durationUs)}" hasAudio="1"><media-rep kind="original-media" src="${xmlEscape(fileURL(external.asset.path))}"/></asset>` : ""}`;
  const clips = regions
    .map((region) => {
      const audio = external && audioRange(region, external);
      return `<asset-clip ref="source" name="${xmlEscape(asset.name)}" offset="${time(region.outputStartUs)}" start="${time(region.startUs)}" duration="${time(region.endUs - region.startUs)}"${external ? ' audioEnabled="0"' : ""}>${audio ? `<asset-clip ref="external" lane="-1" offset="${time(audio.parentStart)}" start="${time(audio.sourceStart)}" duration="${time(audio.duration)}"/>` : ""}</asset-clip>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.10"><resources>${resources}</resources><library><event name="Precut"><project name="${xmlEscape(name)}"><sequence format="format" duration="${time(duration)}" tcStart="0s" tcFormat="NDF"><spine>${clips}</spine></sequence></project></event></library></fcpxml>`;
}
export function premiereXML(
  name: string,
  asset: MediaAsset,
  regions: Region[],
  external?: External,
) {
  const rate = Math.round(asset.fps.numerator / asset.fps.denominator),
    ntsc = asset.fps.denominator === 1001,
    r = `<rate><timebase>${rate}</timebase><ntsc>${ntsc ? "TRUE" : "FALSE"}</ntsc></rate>`,
    defined = new Set<string>();
  const file = (a: MediaAsset) => {
    if (defined.has(a.id)) return `<file id="${a.id}"/>`;
    defined.add(a.id);
    return `<file id="${a.id}"><name>${xmlEscape(a.name)}</name><pathurl>${xmlEscape(fileURL(a.path))}</pathurl>${r}<duration>${frames(a.durationUs, asset.fps)}</duration><media>${a.hasVideo ? `<video><samplecharacteristics>${r}<width>${a.width}</width><height>${a.height}</height></samplecharacteristics></video>` : ""}${a.hasAudio ? `<audio><samplecharacteristics><depth>16</depth><samplerate>${a.sampleRate || 48000}</samplerate></samplecharacteristics><channelcount>${a.channels || 2}</channelcount></audio>` : ""}</media></file>`;
  };
  const clips = (audio: boolean) =>
    regions
      .map((region, i) => {
        const a = audio && external ? external.asset : asset;
        if (audio && !a.hasAudio) return "";
        const part =
          audio && external
            ? audioRange(region, external)
            : {
                sourceStart: region.startUs,
                sourceEnd: region.endUs,
                outputStart: region.outputStartUs,
                duration: region.endUs - region.startUs,
              };
        if (!part) return "";
        return `<clipitem id="${audio ? "a" : "v"}${i}"><name>${xmlEscape(a.name)}</name>${r}<start>${frames(part.outputStart, asset.fps)}</start><end>${frames(part.outputStart + part.duration, asset.fps)}</end><in>${frames(part.sourceStart, asset.fps)}</in><out>${frames(part.sourceEnd, asset.fps)}</out>${file(a)}<sourcetrack><mediatype>${audio ? "audio" : "video"}</mediatype><trackindex>1</trackindex></sourcetrack></clipitem>`;
      })
      .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="5"><sequence><name>${xmlEscape(name)}</name>${r}<duration>${regions.reduce((n, c) => Math.max(n, frames(c.outputStartUs + c.endUs - c.startUs, asset.fps)), 0)}</duration><media>${asset.hasVideo ? `<video><format><samplecharacteristics>${r}<width>${asset.width}</width><height>${asset.height}</height></samplecharacteristics></format><track>${clips(false)}</track></video>` : ""}<audio><track>${clips(true)}</track></audio></media></sequence></xmeml>`;
}
