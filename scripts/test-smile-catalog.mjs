import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function bundle(entry, plugins=[]) {
  const result=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',plugins});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const calls=[];let dbError=null;
const fixture={id:'one',site_key:'joko-today',category:'joko-smile',media_type:'video',media_url:'/film.mp4',is_published:true,sort_order:0,created_at:'2026-10-30',title_en:'English title',title_th:'ชื่อไทย',title_zh:null,caption_en:'English caption'};
const records=[fixture,{...fixture,id:'draft',is_published:false},{...fixture,id:'other',category:'bakery'},{...fixture,id:'site',site_key:'other-site'},{...fixture,id:'image',media_type:'image'},{...fixture,id:'bad-url',media_url:'javascript:alert(1)'},{...fixture,id:'newer',created_at:'2026-10-31'}];
globalThis.__SMILE_DB__={from(table){calls.push(['from',table]);return {select(...args){calls.push(['select',...args]);return this},eq(...args){calls.push(['eq',...args]);return this},order(...args){calls.push(['order',...args]);return this},async limit(){return {data:records,error:dbError}}}}};
const catalog=await bundle('src/lib/smileCatalog.ts',[{name:'fake-db',setup(b){b.onResolve({filter:/^\.\/supabase$/},()=>({path:'supabase',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const supabase = globalThis.__SMILE_DB__',loader:'js'}))}}]);
assert.deepEqual(catalog.publishedSmileEpisodes(records).map(x=>x.id),['newer','one']);
assert.equal(catalog.smileText(fixture,'th').title,'ชื่อไทย');
assert.equal(catalog.smileText(fixture,'zh').title,'English title');
for(const url of ['javascript:alert(1)','data:text/html,attack','//example.test/clip.mp4','/\\example.test/clip.mp4','http://example.test/clip.mp4','https://user:password@example.test/clip.mp4'])assert.equal(catalog.safeSmileUrl(url),null,url);
assert.equal(catalog.smileVideoSource('/own/film.mp4?version=2').kind,'file');
assert.equal(catalog.smileVideoSource('https://youtu.be/ABCDEFGHIJK').url,'https://www.youtube-nocookie.com/embed/ABCDEFGHIJK');
assert.equal(catalog.smileVideoSource('https://www.youtube.com/shorts/ABCDEFGHIJK?feature=share').kind,'youtube');
assert.equal(catalog.smileVideoSource('https://youtube.com.attacker.test/watch?v=ABCDEFGHIJK').kind,'external');
assert.deepEqual((await catalog.getSmileEpisodes()).map(x=>x.id),['newer','one']);
for(const filter of [['eq','site_key','joko-today'],['eq','category','joko-smile'],['eq','media_type','video'],['eq','is_published',true]])assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(filter)));
dbError=new Error('offline');await assert.rejects(()=>catalog.getSmileEpisodes(),/offline/);
delete globalThis.__SMILE_DB__;
const {resolveTopMenu}=await bundle('src/platform/builder/topMenu.ts');
const defaults=resolveTopMenu(undefined),legacy=defaults.filter(item=>item.key!=='smile');
const upgraded=resolveTopMenu(legacy);assert.equal(upgraded.filter(item=>item.key==='smile').length,1);
const canonical=value=>JSON.parse(JSON.stringify(value));
assert.deepEqual(canonical(upgraded.filter(item=>item.key!=='smile')),canonical(legacy));
const hidden=upgraded.map(item=>item.key==='smile'?{...item,visible:false,labels:{en:'Our little films',th:'เรื่องสั้น',zh:'短片'}}:item);
assert.deepEqual(canonical(resolveTopMenu(hidden)),canonical(hidden));
const {validateBuilderDocument}=await bundle('src/platform/builder/validation.ts');
const result=validateBuilderDocument({schemaVersion:1,registryVersion:1,pageKey:'home',branding:{topMenu:upgraded},sections:[]});
assert.deepEqual(result.ok?[]:result.issues.filter(issue=>issue.path.startsWith('branding.topMenu')),[]);
console.log('JOKO SMILE passed: published-only/site/category filtering, localization, URL/embed safety, read failures, legacy menu preservation and admin menu validation.');

const samples = await bundle('src/lib/smileSamples.ts');
assert.equal(samples.smileSamples.length, 6);
assert.ok(samples.smileSamples.every(item => !item.is_published && !item.media_url && item.id.startsWith('sample-')));
const options = {language:'en', search:'', month:'', sort:'newest', counts:samples.sampleLikeCounts};
assert.equal(catalog.filterSmileEpisodes(samples.smileSamples, options)[0].id, 'sample-cookie');
assert.equal(catalog.filterSmileEpisodes(samples.smileSamples, {...options, sort:'oldest'})[0].id, 'sample-crumb');
assert.equal(catalog.filterSmileEpisodes(samples.smileSamples, {...options, sort:'likes'})[0].id, 'sample-balloon');
assert.equal(catalog.filterSmileEpisodes(samples.smileSamples, {...options, month:'2026-09'}).length, 3);
assert.equal(catalog.filterSmileEpisodes(samples.smileSamples, {...options, month:'2026-10', search:'cookie'}).length, 1);
assert.equal(catalog.filterSmileEpisodes(samples.smileSamples, {...options, month:'2026-09', search:'cookie'}).length, 0);
console.log('Sample isolation and combined search/month/date/likes sorting passed.');
// Regression: Favorites deep links must render useful media for each supported source.
const {createElement} = await import('react');
const {renderToStaticMarkup} = await import('react-dom/server');
const {SmilePlayerMedia} = await bundle('src/components/SmilePlayerMedia.tsx', [{name:'no-live-db',setup(b){b.onResolve({filter:/^\.\/supabase$/},()=>({path:'supabase',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const supabase = {}',loader:'js'}))}}]);
const mediaProps = {poster:null,title:'An episode',alt:'Episode poster',externalLabel:'Watch on the original video site',errorLabel:'Cannot play',failed:false,onError(){}};
const renderMedia = mediaUrl => renderToStaticMarkup(createElement(SmilePlayerMedia,{...mediaProps,mediaUrl}));
const externalHtml = renderMedia('https://vimeo.com/123456789');
assert.ok(externalHtml.includes('href="https://vimeo.com/123456789"'));
assert.ok(externalHtml.includes('Watch on the original video site'));
assert.ok(externalHtml.includes('target="_blank"') && externalHtml.includes('noopener noreferrer'));
assert.ok(!externalHtml.includes('<iframe') && !externalHtml.includes('<video'));
assert.ok(renderMedia('/film.mp4').includes('<video'));
assert.ok(renderMedia('https://youtu.be/ABCDEFGHIJK').includes('https://www.youtube-nocookie.com/embed/ABCDEFGHIJK'));
assert.ok(renderMedia('javascript:alert(1)').includes('Cannot play'));
console.log('Favorites player regression passed: external link, direct video, YouTube and unsafe URL fallback.');

const sharing = await bundle('src/lib/smileShare.ts');
const shareUrl = sharing.smileEpisodeShareUrl('episode / ?');
assert.equal(new URL(shareUrl).origin, 'https://joko.today');
assert.equal(new URL(shareUrl).pathname, '/smile');
assert.equal(new URL(shareUrl).searchParams.get('episode'), 'episode / ?');
let copied = '', nativeData = null;
const clipboard = {writeText: async value => { copied = value; }};
assert.equal(await sharing.shareSmileEpisode({share:async data => {nativeData=data;},clipboard}, 'one', 'Title'), 'shared');
assert.equal(nativeData.url, 'https://joko.today/smile?episode=one'); assert.equal(copied, '');
assert.equal(await sharing.shareSmileEpisode({share:async()=>{throw Object.assign(new Error(),{name:'AbortError'});},clipboard}, 'one', 'Title'), 'cancelled');
assert.equal(copied, '');
assert.equal(await sharing.shareSmileEpisode({clipboard}, 'two', 'Title'), 'copied');
assert.equal(copied, 'https://joko.today/smile?episode=two');
assert.equal(await sharing.shareSmileEpisode({share:async()=>{throw new Error('unavailable');},clipboard}, 'three', 'Title'), 'copied');
assert.equal(await sharing.shareSmileEpisode({}, 'one', 'Title'), 'manual');
assert.equal(await sharing.shareSmileEpisode({clipboard:{writeText:async()=>{throw new Error('denied');}}}, 'one', 'Title'), 'manual');
console.log('SMILE sharing passed: canonical deep links, native share, cancellation without copy, clipboard fallback and manual-copy recovery.');

const localization = await bundle('src/lib/smileLocalization.ts');
const playback = await bundle('src/lib/smilePlayback.ts');
const {readFileSync,existsSync} = await import('node:fs');
const cardData = (await bundle('src/lib/smileCardData.ts')).default;
for (const language of ['en','th','zh']) {
  const current = localization.localizedSmileMedia(localization.EP001_ENGLISH_MEDIA, language);
  assert.equal(current.src, localization.EP001_ACTING_WEB_MEDIA);
  assert.equal(current.timing.endingStart, 19.7); assert.equal(current.timing.duration, 27.7);
  assert.equal(current.poster, localization.SMILE_CARD_ASSETS + `poster-${language}.png`);
  const locked = localization.localizedSmileMedia(localization.EP001_WEB_MEDIA, language);
  assert.equal(locked.src, localization.EP001_WEB_MEDIA); assert.equal(locked.timing.endingStart,18.1);
  assert.equal(locked.timing.duration,26.1);
  for (const time of [6.5,12,18.1,19.69]) assert.equal(playback.smileCardPhase(time,current.timing),null);
  const shifted = playback.smileCardPhase(23,current.timing);
  assert.equal(shifted.kind,'ending');assert.ok(Math.abs(shifted.local-3.3)<1e-9);
  const a=cardData[language].ending;
  assert.ok(Math.abs((current.timing.endingStart+a.paths[0].start)-(locked.timing.endingStart+a.paths[0].start)-1.6)<1e-9);
  assert.equal(playback.smileCardPhase(3.9,current.timing).local,3.9);
  assert.ok(Math.abs(current.timing.endingStart+a.paintStart-26.2)<1e-9);
  assert.ok(existsSync('public'+current.src));assert.ok(existsSync('public'+current.poster));
}
assert.equal(playback.smileCardPhase(18.2).kind,'ending'); // Legacy default remains valid.
assert.equal(localization.localizedSmileMedia('/unrelated.mp4','en'),null);
assert.equal(localization.standaloneSmileMedia(localization.EP001_ENGLISH_MEDIA),localization.EP001_ACTING_ENGLISH_MEDIA);
assert.equal(localization.standaloneSmileMedia(localization.EP001_ACTING_WEB_MEDIA),localization.EP001_ACTING_ENGLISH_MEDIA);
assert.equal(localization.standaloneSmileMedia(localization.EP001_WEB_MEDIA),localization.EP001_ENGLISH_MEDIA);
assert.equal(localization.standaloneSmileMedia('/unrelated.mp4'),'/unrelated.mp4');
assert.ok(existsSync('public'+localization.EP001_ACTING_ENGLISH_MEDIA));
const phaseAtEnd=playback.smileCardPhase(27.7,playback.SMILE_ACTING_TIMING);assert.equal(phaseAtEnd.kind,'ending');assert.equal(phaseAtEnd.opacity,1);
assert.ok(readFileSync('src/components/SmileInlinePlayer.tsx','utf8').includes('timing={props.localization.timing}'));
console.log('SMILE acting/localization passed: all three languages, +1.6s closing shift, no action overlays, legacy timing, replay end phase, packaged media and complete-English native fallback.');

// Explicit LINE sharing must work independently of native share availability.
for (const title of ['Ep. 001 — How the Cookies Roll','ตอน 001 — คุกกี้กลิ้งไป… กลิ้งมา','第001集 — 饼干滚呀滚']) {
  const line = new URL(sharing.smileLineShareUrl('episode / ?&=#', title));
  assert.equal(line.origin,'https://social-plugins.line.me');
  assert.equal(line.pathname,'/lineit/share');
  assert.equal(line.searchParams.get('url'),sharing.smileEpisodeShareUrl('episode / ?&=#'));
  assert.equal(line.searchParams.get('text'),title);
  assert.equal(new URL(line.searchParams.get('url')).searchParams.get('episode'),'episode / ?&=#');
  assert.equal([...line.searchParams].length,2);
}
console.log('LINE sharing passed: fixed official destination, encoded episode deep link and EN/TH/ZH titles, no native-share dependency.');
