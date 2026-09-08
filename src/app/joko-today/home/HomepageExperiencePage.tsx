import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { Container, PageCanvas } from '../../../platform/design-system';
import HomepageExperienceHeader from './HomepageExperienceHeader';
import NotebookFeatureSpread from './NotebookFeatureSpread';

interface HomepageExperiencePageProps {
  onNavigate: (page: string) => void;
}

const copy = {
  en: {
    life: 'Life is worth noticing.',
    line1: 'A bakery.',
    line2: 'Curious people.',
    line3: 'One notebook',
    line4: 'that keeps growing.',
    body: 'People come for the bread. They stay for the stories, questions, ideas and small things worth noticing.',
    jokomi: 'Jokomi keeps the notebook.',
    jokomiAlt: 'Jokomi sitting quietly with the FIELD NOTES notebook.',
    bakery: "See what's baking",
    howItWorks: 'New here? How pickup works',
  },
  th: {
    life: 'ชีวิตมีเรื่องเล็ก ๆ ที่ควรค่าแก่การสังเกต',
    line1: 'ร้านเบเกอรี่หนึ่งร้าน',
    line2: 'ผู้คนช่างสงสัย',
    line3: 'สมุดบันทึกหนึ่งเล่ม',
    line4: 'ที่เติบโตขึ้นเรื่อย ๆ',
    body: 'ผู้คนมาหาเราเพราะขนมปัง และอยู่ต่อเพราะเรื่องราว คำถาม ความคิด และสิ่งเล็ก ๆ ที่น่าสังเกต',
    jokomi: 'Jokomi เป็นคนเก็บสมุดบันทึกเล่มนี้',
    jokomiAlt: 'Jokomi นั่งเงียบ ๆ พร้อมสมุด FIELD NOTES',
    bakery: 'ดูว่าวันนี้อบอะไร',
    howItWorks: 'เพิ่งมาใหม่? ดูวิธีรับสินค้า',
  },
  zh: {
    life: '生活值得被留意。',
    line1: '一家烘焙坊。',
    line2: '一群好奇的人。',
    line3: '一本笔记本，',
    line4: '还在不断长大。',
    body: '人们为了面包而来，也会为了故事、问题、想法，以及那些值得留意的小事留下来。',
    jokomi: 'Jokomi 保管着这本笔记。',
    jokomiAlt: 'Jokomi 安静地坐着，带着 FIELD NOTES 笔记本。',
    bakery: '看看今天烤什么',
    howItWorks: '第一次来？看看如何取货',
  },
} as const;

export function HomepageExperiencePage({ onNavigate }: HomepageExperiencePageProps) {
  const { language } = useLanguage();
  const labels = copy[language];

  return (
    <PageCanvas surface="soft" className="min-h-screen bg-background">
      <HomepageExperienceHeader onNavigate={onNavigate} />

      <main>
        <section className="border-b border-primary-900/10 bg-gradient-to-b from-background-secondary/45 via-background to-background pb-10 pt-4 sm:pb-14 sm:pt-6">
          <Container width="wide">
            <p className="mb-5 text-center font-header text-lg font-semibold tracking-wide text-primary-950 sm:text-xl">
              {labels.life} <span className="text-primary-700" aria-hidden="true">♥</span>
            </p>

            <div className="grid gap-10 xl:grid-cols-[minmax(15rem,0.31fr)_minmax(0,1fr)] xl:items-center xl:gap-12">
              <div className="max-w-md">
                <h1 className="font-header text-4xl font-semibold leading-[1.02] tracking-tight text-primary-950 sm:text-5xl xl:text-[3.35rem]">
                  <span className="block">{labels.line1}</span>
                  <span className="mt-1 block">{labels.line2}</span>
                  <span className="mt-1 block text-primary-700">{labels.line3}</span>
                  <span className="mt-1 block text-primary-700">{labels.line4}</span>
                </h1>

                <p className="mt-6 max-w-sm text-base leading-7 text-gray-700 sm:text-lg">
                  {labels.body}
                </p>

                <div className="mt-7 flex min-h-32 items-end gap-3 sm:gap-4">
                  <img
                    src="/assets/home-experience/jokomi-field-notes-v1.webp"
                    alt={labels.jokomiAlt}
                    width={200}
                    height={208}
                    className="h-28 w-28 shrink-0 object-contain mix-blend-multiply sm:h-32 sm:w-32"
                    decoding="async"
                  />
                  <p className="max-w-[12rem] pb-4 font-header text-lg font-semibold leading-6 text-primary-950">
                    {labels.jokomi} <span className="text-primary-700" aria-hidden="true">♥</span>
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('products')}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-primary-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
                  >
                    {labels.bakery}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('how-it-works')}
                    className="flex items-center gap-2 text-sm font-semibold text-primary-950 underline decoration-primary-300 underline-offset-4 transition hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    {labels.howItWorks}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <NotebookFeatureSpread locale={language} onNavigate={onNavigate} />
            </div>
          </Container>
        </section>
      </main>
    </PageCanvas>
  );
}

export default HomepageExperiencePage;
