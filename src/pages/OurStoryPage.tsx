import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Quote } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getPageByKey, type CMSPage } from '../lib/cmsService';
import { Container } from '../platform/design-system';

const OUR_STORY_PAGE_KEY = 'our_story';

const fallbackCopy = {
  en: {
    title: 'Our Story',
    body: `We didn’t actually plan to become bakers.

JOKO started with two people — Joe and Phuttan — a shared weakness for good chocolate, and absolutely no grand business plan.

At first, we made chocolate pralines simply because we enjoyed making them. We gave a few to friends. That turned out to be our first mistake: they wanted more. Then their friends wanted some. Before long, a hobby had become actual orders, and we found ourselves increasing production just to keep up.

So far, so good. We were chocolate makers.

Then one conversation changed everything.

“Can you make croissants?”

While talking about our chocolates with the manager of a hotel in Chiang Mai, we were asked whether we made anything else. Croissants? Bread? Cakes? Pastries?

Caught completely off guard, we answered: “Yes.”

There was just one small problem. We had never made a croissant in our lives.

The hotel asked us to prepare a test batch, which left us with two options: admit that our confidence had travelled considerably faster than our baking skills, or learn how to make croissants. We chose number two.

Fortunately, fate — or questionable shopping habits — had already helped us. A few months earlier, we had bought a second-hand dough sheeter, the machine used for rolling and laminating croissant dough. We didn’t particularly need one at the time. It was simply ridiculously cheap. So we bought it. Why not?

Suddenly, we had a very good reason.

While continuing to make chocolates for our wholesale customers, we started teaching ourselves how to bake. There was flour. There was butter. There was the internet. There were books. And there were a lot of test batches.

Eventually, we reached the point where we were brave enough to bring a test batch to the hotel.

They tasted them.

And… boom. They liked them.

More importantly, they ordered them.

That was our first real step into baking. From there, customers began asking for other pastries. Then breads. Then cakes. Each new request generally produced the same sequence:

“Can you make this?”
“Yes.”
Go home and figure out how.

There followed many late nights researching recipes, testing them, changing them, throwing some away and trying again. Slowly, the range grew.

For quite a while, most of what we made went to wholesale customers around Chiang Mai. Then we heard about a new organic market called Jing Jai Market — JJ Market.

We thought it might be fun to try selling directly to customers for the first time. One weekend, we packed a few boxes of croissants and set up a stall.

A few boxes gradually became considerably more than a few boxes.

As JJ Market grew into one of Chiang Mai’s best-known organic and lifestyle markets, our little stall grew with it. Retail, which had started as an experiment, became the bigger part of the business.

Then Covid arrived.

JJ Market remained open, but the rhythm of the city changed. We felt it was time to move — actually, to make two moves.

First, we built our own bakery in Mae Rim, in the peace of our own garden. That is where we bake today.

Second, a good friend suggested that every Sunday morning we set up our bakery stand outside their busy café in town. We tried it. And we are still there.

As more people began coming to JOKO, another problem appeared. Customers would drive to Mae Rim, or come to see us on Sunday, only to discover that the thing they had come for was already sold out.

Sold out is nice for a bakery. It is considerably less nice for the person who drove across town to buy one.

That is really why joko.today exists.

We wanted customers to see what we are baking, reserve what they want in advance, and choose where and when they would like to collect it.

You get the thing you came for. We know what needs baking. Less waste. Fewer disappointed customers. A fairly simple win-win.

Which brings us to today.

What started with homemade chocolates has somehow become a bakery. There were plenty of accidents along the way: a hotel question we probably should not have answered quite so confidently, a dough sheeter we bought before we knew why we needed it, a market stall that became busier than the wholesale business, and customers who kept showing us what JOKO needed to become next.

We still work much the same way we did at the beginning: make something, taste it, change it, make it again, and only keep it if we genuinely like it.

We never really had a master plan.

So far, that seems to have worked out rather well.

Welcome to JOKO.`,
    eyebrow: 'JOKO TODAY',
    back: 'Back to home',
  },
  th: {
    title: 'เรื่องราวของเรา',
    body: `จริง ๆ แล้ว เราไม่ได้ตั้งใจจะเป็นคนทำเบเกอรี่เลย

JOKO เริ่มต้นจากคนสองคน — Joe และ Phuttan — ความชอบช็อกโกแลตเหมือนกัน และไม่มีแผนธุรกิจอะไรจริงจังเลย

ตอนแรก เราทำช็อกโกแลตพราลีนกันเล่น ๆ เป็นงานอดิเรก เพราะเราชอบช็อกโกแลตเอง เราทำเสร็จแล้วก็เอาไปให้เพื่อน ๆ ลองชิม

ซึ่งปรากฏว่า… นั่นอาจเป็น “ความผิดพลาด” ครั้งแรกของเรา

เพราะเพื่อนอยากได้เพิ่ม จากนั้นเพื่อนของเพื่อนก็อยากได้ด้วย ไม่นาน สิ่งที่เริ่มต้นจากงานอดิเรกก็กลายเป็นออร์เดอร์จริง ๆ

ถึงตรงนี้ทุกอย่างยังดูปกติดี เราเป็นคนทำช็อกโกแลต

จนกระทั่งวันหนึ่ง มีบทสนทนาสั้น ๆ ที่เปลี่ยนทุกอย่าง

“ทำครัวซองต์ได้ไหม?”

ระหว่างที่เราคุยเรื่องช็อกโกแลตกับผู้จัดการโรงแรมแห่งหนึ่งในเชียงใหม่ เขาถามขึ้นมาว่า นอกจากช็อกโกแลตแล้ว ทำอย่างอื่นเป็นไหม? ครัวซองต์? ขนมปัง? เค้ก? ขนมอบอย่างอื่น?

เราถูกถามแบบไม่ทันตั้งตัวเลย และด้วยเหตุผลบางอย่าง เรากลับตอบไปอย่างมั่นใจว่า “ได้ครับ / ค่ะ”

มีปัญหาอยู่นิดเดียว

เราไม่เคยทำครัวซองต์มาก่อนเลยสักครั้ง

โรงแรมขอให้เราทำครัวซองต์ทดลองหนึ่งชุด เพื่อให้ทีมบริหารลองชิม ทันใดนั้น เราก็เหลือทางเลือกอยู่สองทาง: จะกลับไปบอกว่าจริง ๆ แล้วเมื่อกี้เราพูดเกินความสามารถไปนิดหน่อย หรือเรียนรู้วิธีทำครัวซองต์ให้ได้

เราเลือกทางที่สอง

และโชคดีมาก — หรืออาจจะต้องขอบคุณนิสัยชอบซื้อของที่ดูเหมือนจะยังไม่จำเป็นของเราเอง — เพราะไม่กี่เดือนก่อนหน้านั้น เราเพิ่งซื้อเครื่องรีดแป้งมือสอง (dough sheeter) มาเครื่องหนึ่ง ทั้งที่ตอนนั้นยังไม่ได้มีเหตุผลอะไรจริงจังว่าทำไมต้องมีมัน

เหตุผลง่าย ๆ คือ… มันถูกมาก

เราก็เลยคิดว่า “ทำไมจะไม่ซื้อล่ะ?”

แล้วจู่ ๆ เครื่องนั้นก็มีเหตุผลของมันขึ้นมาทันที

ระหว่างที่เรายังคงผลิตช็อกโกแลตส่งให้ลูกค้าขายส่ง เราก็เริ่มหัดทำเบเกอรี่ด้วยตัวเอง มีแป้ง มีเนย มีอินเทอร์เน็ต มีหนังสือ และมีการทดลองอีกนับไม่ถ้วน

ในที่สุด เราก็มาถึงจุดที่กล้าเอาครัวซองต์ชุดทดลองไปให้โรงแรมชิม

แล้วก็… บูม!

เขาชอบมัน และที่สำคัญยิ่งกว่า เขาสั่งซื้อ

นั่นคือก้าวแรกจริง ๆ ของเราเข้าสู่โลกของการทำเบเกอรี่

หลังจากนั้น ลูกค้าเริ่มถามหาขนมอบชนิดอื่น แล้วก็ขนมปัง แล้วก็เค้ก แต่ละคำขอใหม่ ๆ มักจะตามมาด้วยขั้นตอนคล้าย ๆ กัน:

“ทำอันนี้ได้ไหม?”
“ได้”
แล้วค่อยกลับบ้านไปหาวิธีว่าจะทำยังไง

หลายคืนจึงกลายเป็นคืนที่แทบไม่ได้นอน เพราะเราต้องค้นสูตร อ่าน ทดลอง ปรับ ทำใหม่ ทิ้งบ้าง แล้วลองใหม่อีกครั้ง

ต่อมา เราได้ยินข่าวเกี่ยวกับตลาดออร์แกนิกแห่งใหม่ชื่อ Jing Jai Market หรือ JJ Market ตอนนั้นยังเป็นตลาดเล็ก ๆ เราคิดว่า “ลองดูไหม?” แล้วก็แพ็กครัวซองต์ไปไม่กี่กล่องเพื่อลองขายตรงให้ลูกค้าเป็นครั้งแรก

จากไม่กี่กล่องก็ค่อย ๆ กลายเป็นมากกว่านั้นเยอะ

เมื่อ JJ Market เติบโตขึ้น ร้านเล็ก ๆ ของเราก็เติบโตไปพร้อมกับตลาด การขายปลีกที่เริ่มจากการลองดู กลับกลายเป็นส่วนสำคัญของธุรกิจ

แล้วโควิดก็มาถึง

โลกเปลี่ยนไป และเรารู้สึกว่าถึงเวลาต้องขยับ — จริง ๆ แล้วเป็นการขยับสองครั้ง

อย่างแรก เราสร้างโรงอบเบเกอรี่ของเราเองที่แม่ริม อยู่ในความสงบของสวนที่บ้านเราเอง และนี่คือที่ที่เราอบขนมมาจนถึงทุกวันนี้

อย่างที่สอง เพื่อนสนิทคนหนึ่งเสนอว่า ทุกเช้าวันอาทิตย์เราน่าจะเอาเบเกอรี่ไปตั้งขายหน้าคาเฟ่ของเขาในเมือง เราลองดู และจนถึงวันนี้เราก็ยังอยู่ตรงนั้น

เมื่อมีคนรู้จัก JOKO มากขึ้น ปัญหาใหม่ก็เริ่มเกิดขึ้น ลูกค้าบางคนขับรถมาหาเราถึงแม่ริม หรือแวะมาในเมืองวันอาทิตย์ แต่พอมาถึง ของที่ตั้งใจมาซื้อกลับหมดแล้ว

ในมุมของร้านเบเกอรี่ คำว่า “ขายหมด” ฟังดูเป็นเรื่องดี แต่สำหรับคนที่ขับรถข้ามเมืองมาเพื่อซื้อของชิ้นนั้น มันไม่ค่อยน่ายินดีเท่าไร

นั่นคือเหตุผลสำคัญที่ทำให้ joko.today เกิดขึ้น

เราอยากให้ลูกค้าดูได้ล่วงหน้าว่าสัปดาห์นี้เราจะทำอะไร เลือกสิ่งที่อยากได้ สั่งจองไว้ก่อน แล้วเลือกวันและสถานที่รับที่สะดวกที่สุด

คุณได้ของที่ตั้งใจมาซื้อ เรารู้ว่าต้องอบอะไรและควรอบเท่าไร ของเหลือน้อยลง ลูกค้าผิดหวังน้อยลง ถือว่าเป็นเรื่องดีสำหรับทุกฝ่าย

และนั่นพาเรามาถึงวันนี้

สิ่งที่เริ่มต้นจากการทำช็อกโกแลตเล่น ๆ ค่อย ๆ กลายมาเป็นร้านเบเกอรี่ ระหว่างทางมีเรื่องบังเอิญอยู่ไม่น้อย มีคำถามจากโรงแรมที่เราอาจตอบว่า “ได้” อย่างมั่นใจเกินไปนิด มีเครื่องรีดแป้งที่เราซื้อมา ทั้งที่ตอนนั้นยังไม่รู้เลยว่าจะเอาไปทำอะไร และมีลูกค้าที่ค่อย ๆ บอกเราว่า JOKO ควรจะเดินไปทางไหนต่อ

ทุกวันนี้ วิธีทำงานของเรายังคล้ายกับวันแรก ๆ มาก

ทำอะไรบางอย่างขึ้นมา ชิม ปรับ ทำใหม่ ชิมอีกครั้ง แล้วถ้าเรายังไม่ชอบมันจริง ๆ เราก็ยังไม่เอาออกมาขาย

พูดตามตรง เราไม่เคยมี “แผนใหญ่” อะไรมากนัก

แต่จนถึงตอนนี้ ดูเหมือนว่ามันจะพาเรามาได้ไกลพอสมควร

ยินดีต้อนรับสู่ JOKO`,
    eyebrow: 'JOKO TODAY',
    back: 'กลับหน้าแรก',
  },
  zh: {
    title: '我们的故事',
    body: '我们的完整故事即将上线。\n\n我们正在认真整理这些文字，就像认真对待每天出炉的烘焙一样。',
    eyebrow: 'JOKO TODAY',
    back: '返回首页',
  },
} as const;

function localizedPage(page: CMSPage | null, language: 'en' | 'th' | 'zh') {
  const fallback = fallbackCopy[language];
  if (!page) return { title: fallback.title, body: fallback.body };

  if (language === 'th') {
    return {
      title: page.title_th || page.title_en || fallback.title,
      body: page.body_th || page.body_en || fallback.body,
    };
  }

  if (language === 'zh') {
    return {
      title: page.title_zh || page.title_en || fallback.title,
      body: page.body_zh || page.body_en || fallback.body,
    };
  }

  return {
    title: page.title_en || fallback.title,
    body: page.body_en || fallback.body,
  };
}

function StoryBody({ body }: { body: string }) {
  const paragraphs = useMemo(
    () => body
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    [body],
  );

  return (
    <div className="space-y-6 text-base leading-8 text-[#303532]/76 sm:text-lg sm:leading-9">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 18)}`} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

interface OurStoryPageProps {
  onNavigate: (page: string) => void;
}

export default function OurStoryPage({ onNavigate }: OurStoryPageProps) {
  const { language } = useLanguage();
  const locale = language === 'th' || language === 'zh' ? language : 'en';
  const labels = fallbackCopy[locale];
  const [page, setPage] = useState<CMSPage | null>(null);

  useEffect(() => {
    let active = true;

    void getPageByKey(OUR_STORY_PAGE_KEY)
      .then((nextPage) => {
        if (active) setPage(nextPage);
      })
      .catch((error) => {
        console.warn('Our Story CMS content is temporarily unavailable:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const content = localizedPage(page, locale);

  return (
    <div className="joko-mineral-field min-h-screen">
      <section className="relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <Container width="wide">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#55766F] transition hover:text-[#304B45]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {labels.back}
          </button>

          <div className="mx-auto max-w-4xl">
            <div className="mb-10 sm:mb-12">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#3F665E] sm:text-[11px]">
                {labels.eyebrow}
              </p>
              <h1
                className="mt-3 text-5xl font-semibold tracking-[-0.045em] text-[#292D2B] sm:text-6xl lg:text-7xl"
                style={{ fontFamily: 'var(--joko-font-display)' }}
              >
                {content.title}
              </h1>
              <span className="mt-4 block h-[3px] w-36 -rotate-1 rounded-full bg-[#D98242]/75" aria-hidden="true" />
            </div>

            <article className="relative overflow-hidden rounded-[2rem_2.6rem_2.15rem_2.8rem] border border-[#8B765E]/14 bg-[#FFF9EE]/78 px-6 py-9 shadow-[0_18px_46px_rgba(48,75,69,.08)] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
              <Quote className="absolute right-7 top-7 h-12 w-12 text-[#C76624]/14 sm:right-10 sm:top-9" strokeWidth={1.2} aria-hidden="true" />
              <div className="relative max-w-3xl">
                <StoryBody body={content.body} />
              </div>
            </article>
          </div>
        </Container>
      </section>
    </div>
  );
}
