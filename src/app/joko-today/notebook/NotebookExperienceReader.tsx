import { ArrowLeft, BookOpen, Clock3, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { getProductBySlug, type CMSProduct } from '../../../lib/cmsService';
import type { ResolvedNotebookContent } from '../../../lib/notebookContent';
import {
  NotebookReader,
  type NotebookBlock,
  type NotebookEntry,
  type NotebookFixtureBundle,
  type NotebookLocalizedText,
  type NotebookProductEntry,
  type NotebookRouteTarget,
  type NotebookTodayDocument,
} from '../../../platform/notebook';
import NotebookFeatureSpread from '../home/NotebookFeatureSpread';
import NotebookProductCommerceBridge from './NotebookProductCommerceBridge';

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
  },
} as const;

type LanguageCode = keyof typeof copy;

function localized(value: string): NotebookLocalizedText {
  return { en: value, th: value, zh: value };
}

function findEntry(bundle: NotebookFixtureBundle, target: NotebookRouteTarget): NotebookEntry | null {
  if (target.type === 'notebook.person') {
    return bundle.entries.find((entry) => entry.kind === 'person' && entry.slug === target.slug) ?? null;
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

  const firstSurface = { id: `entry-${entry.id}-primary`, blocks: firstBlocks };

  const secondBlocks = [] as NotebookTodayDocument['surfaces'][number]['blocks'];

  if (entry.kind === 'person' && entry.favoriteProductRef) {
    secondBlocks.push({
      id: `entry-${entry.id}-favorite`,
      type: 'entry-link',
      entryRef: entry.favoriteProductRef,
      label: localized(labels.favorite),
      note: entry.summary,
    });
  }

  if (entry.kind === 'product') {
    if (entry.heroAsset) {
      secondBlocks.push({
        id: `entry-${entry.id}-hero`,
        type: 'asset',
        asset: entry.heroAsset,
        alt: entry.title,
      });
    }
    if (entry.note) {
      secondBlocks.push({
        id: `entry-${entry.id}-note`,
        type: 'callout',
        heading: localized(labels.fromNotebook),
        body: entry.note,
      });
    }
  }

  if (entry.kind === 'question') {
    if (entry.heroAsset) {
      secondBlocks.push({
        id: `entry-${entry.id}-hero`,
        type: 'asset',
        asset: entry.heroAsset,
        alt: entry.title,
      });
    }
    secondBlocks.push({
      id: `entry-${entry.id}-answer`,
      type: 'callout',
      heading: localized(labels.firstClue),
      body: entry.answerTeaser ?? entry.summary,
    });
  }

  return {
    schemaVersion: 1,
    id: `entry-${entry.id}`,
    siteId: bundle.site.siteId,
    date: bundle.today.date,
    title: entry.title,
    surfaces: [firstSurface, ...(secondBlocks.length ? [{ id: `entry-${entry.id}-secondary`, blocks: secondBlocks }] : [])],
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

  const resolveAsset = (asset: { id: string }) => {
    const src = content.assetUrls[asset.id];
    return src ? { src } : null;
  };

  return (
    <section id="community-notebook-reader" className="min-w-0 lg:-mr-3 xl:-mr-6" aria-label={labels.notebook}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1 text-sm font-semibold text-primary-950">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 transition hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {labels.back}
        </button>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onNavigate({ type: 'notebook.today' })}
            aria-current={target.type === 'notebook.today' ? 'page' : undefined}
            className="inline-flex min-h-10 items-center rounded-md px-3 transition hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {labels.today}
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ type: 'notebook.history' })}
            aria-current={target.type === 'notebook.history' ? 'page' : undefined}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 transition hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {labels.history}
            <Clock3 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-primary-950/70 transition hover:bg-primary-50 hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {labels.close}
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

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
        />
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
