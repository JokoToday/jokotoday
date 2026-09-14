import type { CuriosityNotebookConfig } from '../contracts';
import { assertValidCuriosityNotebookConfig } from '../collections';
import { jokoTodayCuriosityFixture } from './jokoTodayCuriosityFixture';

const config = {
  siteId: 'joko-today',
  defaultCollectionSlug: 'today',
  collections: [
    {
      id: 'joko-curiosity-today',
      slug: 'today',
      kind: 'editorial',
      label: { en: 'Today', th: 'วันนี้', zh: '今日' },
      description: {
        en: 'What is worth wondering about today?',
        th: 'วันนี้มีอะไรที่น่าหยุดคิดและสงสัย?',
        zh: '今天有什么值得继续琢磨？',
      },
      order: 10,
      visible: true,
      episodeIds: [
        'curiosity-warm-bread-smell',
        'curiosity-joko-ordering',
        'curiosity-yellow-flowers',
        'curiosity-soft-bread',
      ],
    },
    {
      id: 'joko-curiosity-bakery-science',
      slug: 'bakery-science',
      kind: 'topic',
      label: { en: 'Bakery Science', th: 'วิทยาศาสตร์การอบ', zh: '烘焙科学' },
      description: {
        en: 'Shared questions about dough, heat, fermentation, texture, aroma and the science behind baking.',
        th: 'คำถามร่วมกันเรื่องแป้ง ความร้อน การหมัก เนื้อสัมผัส กลิ่น และวิทยาศาสตร์เบื้องหลังการอบ',
        zh: '关于面团、热、发酵、口感、香气与烘焙原理的共享问题。',
      },
      order: 20,
      visible: true,
      topics: ['baking', 'bread', 'croissants', 'lamination', 'fermentation', 'dough', 'flour', 'yeast', 'aroma', 'texture'],
      match: 'any',
      scopes: ['shared'],
    },
    {
      id: 'joko-curiosity-at-joko',
      slug: 'at-joko',
      kind: 'host',
      label: { en: 'At JOKO', th: 'ที่ JOKO', zh: '在 JOKO' },
      description: {
        en: 'Questions specifically connected to how JOKO bakes, chooses, plans and works.',
        th: 'คำถามที่เชื่อมโยงโดยตรงกับวิธีที่ JOKO อบ เลือก วางแผน และทำงาน',
        zh: '与 JOKO 如何烘焙、选择、安排和运作直接相关的问题。',
      },
      order: 30,
      visible: true,
      hostId: 'joko-today',
    },
    {
      id: 'joko-curiosity-everyday',
      slug: 'everyday',
      kind: 'topic',
      label: { en: 'Everyday Curiosity', th: 'ความสงสัยในชีวิตประจำวัน', zh: '日常好奇' },
      navLabel: { en: 'Everyday', th: 'รอบตัว', zh: '日常' },
      description: {
        en: 'Interesting questions that begin with ordinary things we notice beyond the bakery.',
        th: 'คำถามน่าสนใจที่เริ่มจากสิ่งธรรมดารอบตัวเรา นอกเหนือจากเรื่องเบเกอรี่',
        zh: '从烘焙坊之外日常所见的小事开始的有趣问题。',
      },
      order: 40,
      visible: true,
      topics: ['everyday-science', 'flowers', 'plants', 'colour', 'nature', 'materials'],
      match: 'any',
      scopes: ['shared'],
    },
    {
      id: 'joko-curiosity-people',
      slug: 'people',
      kind: 'provenance',
      label: { en: 'People', th: 'ผู้คน', zh: '人物' },
      description: {
        en: 'Questions real people have wondered about. The question stays the star; the person is its human fingerprint.',
        th: 'คำถามที่ผู้คนสงสัยจริง ๆ คำถามยังคงเป็นตัวเอก ส่วนผู้คนคือร่องรอยของความสงสัยนั้น',
        zh: '真实的人曾经好奇过的问题。问题仍是主角，人只是留下好奇的人类印记。',
      },
      order: 50,
      visible: true,
      emptyMessage: {
        en: 'No questions from people yet. When a real Curiosity Persona contributes one, it will appear here.',
        th: 'ยังไม่มีคำถามจากผู้คน เมื่อมี Curiosity Persona ตัวจริงส่งคำถาม คำถามนั้นจะปรากฏที่นี่',
        zh: '还没有来自真实人物的问题。当真正的 Curiosity Persona 提出问题后，它会出现在这里。',
      },
      originTypes: ['community', 'person'],
    },
    {
      id: 'joko-curiosity-still-wondering',
      slug: 'still-wondering',
      kind: 'answer-state',
      label: { en: 'Still Wondering', th: 'ยังสงสัยอยู่', zh: '还在好奇' },
      description: {
        en: 'Questions the Notebook is still following. An unanswered question can be worth keeping.',
        th: 'คำถามที่สมุดบันทึกยังติดตามอยู่ เพราะคำถามที่ยังไม่มีคำตอบก็ยังควรค่าแก่การเก็บไว้',
        zh: '笔记本仍在追寻的问题。还没有答案的问题，也值得被留下。',
      },
      order: 60,
      visible: true,
      answerStatuses: ['unanswered', 'partial', 'still-wondering'],
    },
    {
      id: 'joko-curiosity-most-wondered',
      slug: 'most-wondered',
      kind: 'ranking',
      label: { en: 'Most Wondered', th: 'สงสัยมากที่สุด', zh: '最多人好奇' },
      navLabel: { en: 'Most Wondered', th: 'สงสัยมาก', zh: '最多人好奇' },
      description: {
        en: 'Questions many people have wondered about too, ranked only by real wonder signals.',
        th: 'คำถามที่หลายคนสงสัยเหมือนกัน จัดลำดับจากสัญญาณความสงสัยจริงเท่านั้น',
        zh: '许多人也曾好奇的问题，只按照真实的好奇信号排序。',
      },
      emptyMessage: {
        en: 'No real wonder signals yet. When people start using “I wondered that too”, the most-wondered questions will appear here.',
        th: 'ยังไม่มีสัญญาณความสงสัยจริง เมื่อผู้คนเริ่มใช้ “ฉันก็สงสัยเหมือนกัน” คำถามที่มีคนสงสัยมากที่สุดจะปรากฏที่นี่',
        zh: '还没有真实的好奇信号。有人开始使用“我也好奇”后，最多人好奇的问题才会出现在这里。',
      },
      order: 70,
      visible: true,
      metric: 'wonder-count',
      minimumCount: 1,
      limit: 20,
    },
  ],
} satisfies CuriosityNotebookConfig;

export const jokoTodayNotebookConfig = assertValidCuriosityNotebookConfig(
  config,
  jokoTodayCuriosityFixture.episodes,
);
