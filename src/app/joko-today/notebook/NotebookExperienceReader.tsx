import { BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { getProductBySlug, type CMSProduct } from '../../../lib/cmsService';
import type { ResolvedNotebookContent } from '../../../lib/notebookContent';
import {
  fetchMostNoticed,
  type NotebookMostNoticedItem,
  type NotebookReactionTarget,
} from '../../../lib/notebookReactionsService';
import {
  NotebookReader,
  type NotebookBlock,
  type NotebookEntry,
  type NotebookFixtureBundle,
  type NotebookIndexKind,
  type NotebookLocalizedText,
  type NotebookProductEntry,
  type NotebookRouteTarget,
  type NotebookTodayDocument,
} from '../../../platform/notebook';
import NotebookFeatureSpread from '../home/NotebookFeatureSpread';
import NotebookProductCommerceBridge from './NotebookProductCommerceBridge';
import NotebookReactionButton from './NotebookReactionButton';
import NotebookTopTabs from './NotebookTopTabs';

interface NotebookExperienceReaderProps {
  target: NotebookRouteTarget;
  closed: boolean;
  onNavigate: (target: NotebookRouteTarget) => void;
  onBack: () => void;
  onClose: () => void;
  onOpen: () => void;
  content: ResolvedNotebookContent;
  onCommerceNavigate?: (page: string) => void;
}

const copy = {
  en: {
    back: 'Back',
    today: 'Today',
    history: 'History',
    close: 'Close for now',
    notebook: 'Community Notebook',
    keptBy: 'kept by Jokomi',
    open: 'Open notebook',
    person: 'Person',
    product: 'From the bakery',
    question: 'Curiosity',
    firstClue: 'A first clue',
    favorite: 'A small favourite',
    fromNotebook: 'From the notebook',
    notFound: "This page isn't in the notebook yet.",
    noHistory: 'No earlier pages have been kept yet.',
    loadingProduct: 'Checking the bakery for this product…',
    people: 'People',
    curiosities: 'Curiosities',
    places: 'Places',
    products: 'Products',
    indexIntro: 'An index of what the notebook has noticed so far.',
    todayStory: "From today’s page",
    openTodayStory: "Open today’s page",
    placeToday: "Today’s place",
    storyTrail: "This is the same note kept on Today’s page.",
    noticed: 'Most noticed',
    noticedIntro: 'A quiet look at what readers have been noticing lately.',
    noticedEmpty: 'Nothing has gathered much attention yet.',
    openPage: 'Open this page',
    noticesLately: 'notices lately',
    loadingNoticed: 'Looking through recent notes…',
  },
  th: {
    back: 'ย้อนกลับ',
    today: 'วันนี้',
    history: 'ย้อนหลัง',
    close: 'ปิดไว้ก่อน',
    notebook: 'สมุดบันทึกชุมชน',
    keptBy: 'เก็บไว้โดย Jokomi',
    open: 'เปิดสมุดบันทึก',
    person: 'ผู้คน',
    product: 'จากเบเกอรี่',
    question: 'ความสงสัย',
    firstClue: 'คำใบ้แรก',
    favorite: 'ของโปรดเล็ก ๆ',
    fromNotebook: 'จากสมุดบันทึก',
    notFound: 'ยังไม่มีหน้านี้ในสมุดบันทึก',
    noHistory: 'ยังไม่มีหน้าก่อนหน้านี้ในสมุดบันทึก',
    loadingProduct: 'กำลังตรวจสอบสินค้านี้จากเบเกอรี่…',
    people: 'ผู้คน',
    curiosities: 'ความสงสัย',
    places: 'สถานที่',
    products: 'สินค้า',
    indexIntro: 'ดัชนีของสิ่งที่สมุดบันทึกได้พบเห็นจนถึงตอนนี้',
    todayStory: 'จากหน้าวันนี้',
    openTodayStory: 'เปิดหน้าวันนี้',
    placeToday: 'สถานที่ของวันนี้',
    storyTrail: 'นี่คือบันทึกเดียวกับที่เก็บไว้ในหน้าวันนี้',
    noticed: 'ถูกสังเกตมากที่สุด',
    noticedIntro: 'มองอย่างเงียบ ๆ ว่าช่วงนี้ผู้อ่านกำลังสังเกตอะไรอยู่',
    noticedEmpty: 'ยังไม่มีหน้าไหนถูกสังเกตมากเป็นพิเศษ',
    openPage: 'เปิดหน้านี้',
    noticesLately: 'ครั้งที่ถูกสังเกตช่วงนี้',
    loadingNoticed: 'กำลังเปิดดูบันทึกล่าสุด…',
  },
  zh: {
    back: '返回',
    today: '今日',
    history: '往期',
    close: '先合上',
    notebook: '社区笔记本',
    keptBy: '由 Jokomi 保管',
    open: '打开笔记本',
    person: '人物',
    product: '来自烘焙坊',
    question: '好奇',
    firstClue: '第一个线索',
    favorite: '一个小小的最爱',
    fromNotebook: '来自笔记本',
    notFound: '这页还没有被收进笔记本。',
    noHistory: '笔记本里还没有保存往期页面。',
    loadingProduct: '正在从烘焙坊查询这个商品…',
    people: '人物',
    curiosities: '好奇',
    places: '地点',
    products: '产品',
    indexIntro: '这里收录了笔记本目前留意到的人、事与发现。',
    todayStory: '来自今日一页',
    openTodayStory: '打开今日一页',
    placeToday: '今天的地点',
    storyTrail: '这就是今日一页里保存的同一则笔记。',
    noticed: '最受留意',
    noticedIntro: '安静看看最近读者都在留意什么。',
    noticedEmpty: '暂时还没有哪一页特别受到留意。',
    openPage: '打开这一页',
    noticesLately: '次最近留意',
    loadingNoticed: '正在翻看最近的笔记…',
  },
} as const;

type LanguageCode = keyof typeof copy;

function localized(value: string): NotebookLocalizedText {
  return { en: value, th: value, zh: value };
}

function findEntry(bundle: NotebookFixtureBundle, target: NotebookRouteTarget): NotebookEntry | null {
  if (target.type === 'notebook.person') {
    const direct = bundle.entries.find((entry) => entry.kind === 'person' && entry.slug === target.slug) ?? null;
    if (direct) return direct;
    if (target.slug === 'featured-person') {
      return bundle.entries.find((entry) => entry.kind === 'person') ?? null;
    }
    return null;
  }
  if (target.type === 'notebook.product') {
    return bundle.entries.find((entry) => entry.kind === 'product' && entry.slug === target.slug) ?? null;
  }
  if (target.type === 'notebook.question') {
    return bundle.entries.find((entry) => entry.kind === 'question' && entry.slug === target.slug) ?? null;
  }
  return null;
}

function entryDocument(
  entry: NotebookEntry,
  bundle: NotebookFixtureBundle,
  labels: (typeof copy)[LanguageCode],
): NotebookTodayDocument {
  const firstBlocks: NotebookBlock[] = [
    {
      id: `entry-${entry.id}-intro`,
      type: 'text',
      eyebrow: localized(
        entry.kind === 'person' ? labels.person : entry.kind === 'product' ? labels.product : labels.question,
      ),
      heading: entry.kind === 'question' ? entry.question : entry.title,
      body: entry.summary,
    },
  ];

  if (entry.kind === 'person' && entry.portraitAsset) {
    firstBlocks.push({
      id: `entry-${entry.id}-portrait`,
      type: 'asset',
      asset: entry.portraitAsset,
      alt: entry.title,
    });
  }

  const surfaces: NotebookTodayDocument['surfaces'] = [
    { id: `entry-${entry.id}-primary`, blocks: firstBlocks },
  ];

  if (entry.kind === 'person') {
    const storyBlocks: NotebookBlock[] = [{
      id: `entry-${entry.id}-today-story`,
      type: 'text',
      eyebrow: localized(labels.todayStory),
      heading: bundle.today.title,
      body: bundle.today.subtitle,
    }];
    const todayScene = bundle.today.surfaces
      .flatMap((surface) => surface.blocks)
      .find((block): block is Extract<NotebookBlock, { type: 'asset' }> => block.type === 'asset');
    if (todayScene) {
      storyBlocks.push({
        ...todayScene,
        id: `entry-${entry.id}-today-scene`,
      });
    }
    storyBlocks.push({
      id: `entry-${entry.id}-today-link`,
      type: 'callout',
      body: localized(labels.storyTrail),
      action: {
        label: localized(labels.openTodayStory),
        target: { type: 'notebook.today' },
      },
    });
    surfaces.push({ id: `entry-${entry.id}-story`, blocks: storyBlocks });

    if (entry.favoriteProductRef) {
      surfaces.push({
        id: `entry-${entry.id}-favourite`,
        blocks: [{
          id: `entry-${entry.id}-favorite`,
          type: 'entry-link',
          entryRef: entry.favoriteProductRef,
          label: localized(labels.favorite),
          note: entry.summary,
        }],
      });
    }
  }

  if (entry.kind === 'product') {
    const blocks: NotebookBlock[] = [];
    if (entry.heroAsset) {
      blocks.push({ id: `entry-${entry.id}-hero`, type: 'asset', asset: entry.heroAsset, alt: entry.title });
    }
    if (entry.note) {
      blocks.push({ id: `entry-${entry.id}-note`, type: 'callout', heading: localized(labels.fromNotebook), body: entry.note });
    }
    if (blocks.length) surfaces.push({ id: `entry-${entry.id}-secondary`, blocks });
  }

  if (entry.kind === 'question') {
    const blocks: NotebookBlock[] = [];
    if (entry.heroAsset) {
      blocks.push({ id: `entry-${entry.id}-hero`, type: 'asset', asset: entry.heroAsset, alt: entry.title });
    }
    blocks.push({
      id: `entry-${entry.id}-answer`,
      type: 'callout',
      heading: localized(labels.firstClue),
      body: entry.answerTeaser ?? entry.summary,
    });
    surfaces.push({ id: `entry-${entry.id}-secondary`, blocks });
  }

  return {
    schemaVersion: 1,
    id: `entry-${entry.id}`,
    siteId: bundle.site.siteId,
    date: bundle.today.date,
    title: entry.title,
    surfaces,
    featuredEntryRefs: [],
  };
}

function commerceProductEntry(product: CMSProduct): NotebookProductEntry {
  return {
    id: `commerce-${product.id}`,
    kind: 'product',
    slug: product.slug,
    status: 'published',
    title: {
      en: product.name_en,
      th: product.name_th || product.name_en,
      zh: product.name_zh || product.name_en,
    },
    summary: {
      en: product.desc_en || product.name_en,
      th: product.desc_th || product.desc_en || product.name_th || product.name_en,
      zh: product.desc_zh || product.desc_en || product.name_zh || product.name_en,
    },
    editorialProductRef: `joko-today:${product.slug}`,
  };
}

function historyDocument(
  bundle: NotebookFixtureBundle,
  labels: (typeof copy)[LanguageCode],
): NotebookTodayDocument {
  const blocks = bundle.history.length
    ? bundle.history.flatMap((item, index) => [{
        id: `history-${item.todayDocumentId}-${index}`,
        type: 'text' as const,
        eyebrow: localized(item.date),
        heading: item.title,
        body: item.excerpt,
      }])
    : [{
        id: 'history-empty',
        type: 'text' as const,
        eyebrow: localized(labels.history),
        heading: localized(labels.noHistory),
      }];

  return {
    schemaVersion: 1,
    id: 'notebook-history',
    siteId: bundle.site.siteId,
    date: bundle.today.date,
    title: localized(labels.history),
    surfaces: [{ id: 'notebook-history-surface', blocks }],
    featuredEntryRefs: [],
  };
}

function indexDocument(
  index: NotebookIndexKind,
  bundle: NotebookFixtureBundle,
  labels: (typeof copy)[LanguageCode],
): NotebookTodayDocument {
  const title = localized(labels[index]);
  const blocks: NotebookBlock[] = [{
    id: `index-${index}-intro`,
    type: 'text',
    eyebrow: localized(labels.notebook),
    heading: title,
    body: localized(labels.indexIntro),
  }];

  if (index === 'places') {
    blocks.push({
      id: 'index-places-today',
      type: 'callout',
      heading: localized(labels.placeToday),
      body: bundle.today.subtitle ?? bundle.today.title,
      action: {
        label: localized(labels.openTodayStory),
        target: { type: 'notebook.today' },
      },
    });
  } else {
    const kind = index === 'people' ? 'person' : index === 'products' ? 'product' : 'question';
    bundle.entries
      .filter((entry) => entry.kind === kind && entry.status === 'published')
      .forEach((entry) => {
        blocks.push({
          id: `index-${index}-${entry.id}`,
          type: 'entry-link',
          entryRef: { kind: entry.kind, id: entry.id },
          label: title,
          note: entry.summary,
        });
      });
  }

  return {
    schemaVersion: 1,
    id: `notebook-index-${index}`,
    siteId: bundle.site.siteId,
    date: bundle.today.date,
    title,
    surfaces: [{ id: `notebook-index-${index}-surface`, blocks }],
    featuredEntryRefs: [],
  };
}

function mostNoticedTarget(
  item: NotebookMostNoticedItem,
  bundle: NotebookFixtureBundle,
): { title: NotebookLocalizedText; target: NotebookRouteTarget } | null {
  if (item.type === 'today' && item.id === bundle.today.id) {
    return { title: bundle.today.title, target: { type: 'notebook.today' } };
  }

  if (item.type === 'person' || item.type === 'product' || item.type === 'question') {
    const entry = bundle.entries.find((candidate) => candidate.kind === item.type && candidate.slug === item.id);
    if (!entry) return null;
    const target: NotebookRouteTarget = item.type === 'person'
      ? { type: 'notebook.person', slug: entry.slug }
      : item.type === 'product'
        ? { type: 'notebook.product', slug: entry.slug }
        : { type: 'notebook.question', slug: entry.slug };
    return { title: entry.title, target };
  }

  return null;
}

function mostNoticedDocument(
  items: NotebookMostNoticedItem[],
  bundle: NotebookFixtureBundle,
  labels: (typeof copy)[LanguageCode],
): NotebookTodayDocument {
  const blocks: NotebookBlock[] = [{
    id: 'most-noticed-intro',
    type: 'text',
    eyebrow: localized(labels.notebook),
    heading: localized(labels.noticed),
    body: localized(labels.noticedIntro),
  }];

  let visibleItems = 0;
  items.forEach((item, index) => {
    const resolved = mostNoticedTarget(item, bundle);
    if (!resolved) return;
    visibleItems += 1;
    blocks.push({
      id: `most-noticed-${item.type}-${item.id}-${index}`,
      type: 'callout',
      heading: resolved.title,
      body: localized(`${item.count} ${labels.noticesLately}`),
      action: { label: localized(labels.openPage), target: resolved.target },
    });
  });

  if (visibleItems === 0) {
    blocks.push({
      id: 'most-noticed-empty',
      type: 'text',
      heading: localized(labels.noticedEmpty),
    });
  }

  return {
    schemaVersion: 1,
    id: 'notebook-most-noticed',
    siteId: bundle.site.siteId,
    date: bundle.today.date,
    title: localized(labels.noticed),
    surfaces: [{ id: 'notebook-most-noticed-surface', blocks }],
    featuredEntryRefs: [],
  };
}

function notFoundDocument(
  bundle: NotebookFixtureBundle,
  labels: (typeof copy)[LanguageCode],
): NotebookTodayDocument {
  return {
    schemaVersion: 1,
    id: 'notebook-not-found',
    siteId: bundle.site.siteId,
    date: bundle.today.date,
    title: localized(labels.notebook),
    surfaces: [{
      id: 'notebook-not-found-surface',
      blocks: [{
        id: 'notebook-not-found-copy',
        type: 'text',
        eyebrow: localized(labels.notebook),
        heading: localized(labels.notFound),
      }],
    }],
    featuredEntryRefs: [],
  };
}

function reactionTargetFor(
  target: NotebookRouteTarget,
  bundle: NotebookFixtureBundle,
  entry: NotebookEntry | null,
): NotebookReactionTarget | null {
  if (target.type === 'notebook.today') return { type: 'today', id: bundle.today.id };
  if (!entry) return null;
  if (target.type === 'notebook.person') return { type: 'person', id: target.slug };
  if (target.type === 'notebook.product') return { type: 'product', id: target.slug };
  if (target.type === 'notebook.question') return { type: 'question', id: target.slug };
  return null;
}

export function NotebookExperienceReader({
  target,
  closed,
  onNavigate,
  onBack,
  onClose,
  onOpen,
  content,
  onCommerceNavigate,
}: NotebookExperienceReaderProps) {
  const { language } = useLanguage();
  const lang: LanguageCode = language === 'th' || language === 'zh' ? language : 'en';
  const labels = copy[lang];
  const { bundle } = content;
  const [routeProduct, setRouteProduct] = useState<CMSProduct | null>(null);
  const [routeProductLoading, setRouteProductLoading] = useState(false);
  const [mostNoticed, setMostNoticed] = useState<NotebookMostNoticedItem[]>([]);
  const [mostNoticedLoading, setMostNoticedLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (target.type !== 'notebook.product') {
      setRouteProduct(null);
      setRouteProductLoading(false);
      return () => { active = false; };
    }

    if (content.commerceProduct?.slug === target.slug) {
      setRouteProduct(content.commerceProduct);
      setRouteProductLoading(false);
      return () => { active = false; };
    }

    setRouteProductLoading(true);
    setRouteProduct(null);
    void getProductBySlug(target.slug)
      .then((product) => { if (active) setRouteProduct(product); })
      .catch((error) => {
        console.error('Could not resolve Notebook commerce product:', error);
        if (active) setRouteProduct(null);
      })
      .finally(() => { if (active) setRouteProductLoading(false); });

    return () => { active = false; };
  }, [content.commerceProduct, target]);

  useEffect(() => {
    let active = true;
    if (target.type !== 'notebook.noticed') {
      setMostNoticedLoading(false);
      return () => { active = false; };
    }

    setMostNoticedLoading(true);
    void fetchMostNoticed()
      .then((items) => { if (active) setMostNoticed(items); })
      .finally(() => { if (active) setMostNoticedLoading(false); });

    return () => { active = false; };
  }, [target]);

  useEffect(() => {
    if (closed || target.type !== 'notebook.person' || target.section !== 'today-story') return;
    const person = findEntry(bundle, target);
    if (!person) return;

    const frame = window.requestAnimationFrame(() => {
      window.document.getElementById(`notebook-surface-entry-${person.id}-story`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [bundle, closed, target]);

  if (closed) {
    return (
      <section className="min-w-0 lg:-mr-3 xl:-mr-6" aria-label={labels.notebook}>
        <div className="relative mx-auto flex min-h-[34rem] max-w-[68rem] items-center justify-center rounded-[2.35rem] border border-primary-900/15 bg-primary-800 px-8 py-12 text-center shadow-2xl sm:min-h-[38rem]">
          <div className="max-w-md text-background">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-background/65">JOKO</p>
            <h2 className="mt-4 font-header text-4xl font-semibold sm:text-5xl">{labels.notebook}</h2>
            <p className="mt-3 font-header text-lg italic text-background/75">{labels.keptBy}</p>
            <button
              type="button"
              onClick={onOpen}
              className="mt-9 inline-flex min-h-12 items-center gap-2 rounded-full bg-background px-6 py-3 text-base font-semibold text-primary-950 shadow-sm transition hover:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-background focus:ring-offset-2 focus:ring-offset-primary-800"
            >
              <BookOpen className="h-5 w-5" aria-hidden="true" />
              {labels.open}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const bundleEntry = findEntry(bundle, target);
  const commerceProduct = target.type === 'notebook.product' ? routeProduct : null;
  const commerceEntry = !bundleEntry && commerceProduct ? commerceProductEntry(commerceProduct) : null;
  const entry = bundleEntry ?? commerceEntry;
  const readerEntries = commerceEntry ? [...bundle.entries, commerceEntry] : bundle.entries;
  const document = target.type === 'notebook.today'
    ? bundle.today
    : target.type === 'notebook.history'
    ? historyDocument(bundle, labels)
    : target.type === 'notebook.noticed'
    ? mostNoticedLoading
      ? {
          schemaVersion: 1 as const,
          id: 'notebook-most-noticed-loading',
          siteId: bundle.site.siteId,
          date: bundle.today.date,
          title: localized(labels.noticed),
          surfaces: [{ id: 'notebook-most-noticed-loading-surface', blocks: [{
            id: 'notebook-most-noticed-loading-copy',
            type: 'text' as const,
            eyebrow: localized(labels.noticed),
            heading: localized(labels.loadingNoticed),
          }] }],
          featuredEntryRefs: [],
        }
      : mostNoticedDocument(mostNoticed, bundle, labels)
    : target.type === 'notebook.index'
    ? indexDocument(target.index, bundle, labels)
    : entry
    ? entryDocument(entry, bundle, labels)
    : target.type === 'notebook.product' && routeProductLoading
    ? {
        schemaVersion: 1 as const,
        id: 'notebook-product-loading',
        siteId: bundle.site.siteId,
        date: bundle.today.date,
        title: localized(labels.product),
        surfaces: [{ id: 'notebook-product-loading-surface', blocks: [{
          id: 'notebook-product-loading-copy',
          type: 'text' as const,
          eyebrow: localized(labels.product),
          heading: localized(labels.loadingProduct),
        }] }],
        featuredEntryRefs: [],
      }
    : notFoundDocument(bundle, labels);

  const reactionTarget = reactionTargetFor(target, bundle, entry);

  const resolveAsset = (asset: { id: string }) => {
    const src = content.assetUrls[asset.id];
    return src ? { src } : null;
  };

  return (
    <section id="community-notebook-reader" className="min-w-0 lg:-mr-3 xl:-mr-6" aria-label={labels.notebook}>
      <NotebookTopTabs
        target={target}
        onNavigate={onNavigate}
        onBack={onBack}
        onClose={onClose}
      />

      {target.type === 'notebook.today' ? (
        <NotebookFeatureSpread
          locale={lang}
          onNavigate={() => undefined}
          bundle={bundle}
          sceneImageUrl={content.assetUrls['today-scene']}
          featuredProductImageUrl={content.featuredProductImageUrl}
          hideNavigation
          onNotebookNavigate={onNavigate}
        />
      ) : (
        <NotebookReader
          document={document}
          entries={readerEntries}
          locale={lang}
          defaultLocale={bundle.site.defaultLocale}
          resolveAsset={resolveAsset}
          onNavigate={onNavigate}
          hideDocumentMeta
        />
      )}

      {reactionTarget && (
        <NotebookReactionButton key={`${reactionTarget.type}:${reactionTarget.id}`} target={reactionTarget} locale={lang} />
      )}

      {target.type === 'notebook.product' && commerceProduct && onCommerceNavigate && (
        <NotebookProductCommerceBridge
          product={commerceProduct}
          onOpenBakery={() => onCommerceNavigate(`product/${commerceProduct.slug}`)}
        />
      )}
    </section>
  );
}

export default NotebookExperienceReader;
