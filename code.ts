// ux톤 적용하기 – Figma Plugin main code
// GLN UX & Communication Standards v1.0 기반 전면 적용

// ========== 타입 정의 ==========

type SentenceType = 'declarative' | 'interrogative' | 'imperative' | 'unknown';

type EmotionTone =
  | 'neutral'
  | 'enthusiastic'
  | 'friendly'
  | 'professional'
  | 'playful';

type RuleCategory =
  | 'tone'         // 직접 표현 개선
  | 'formal'       // 격식체 → 비격식체
  | 'command'      // 명령형 → 정중한 요청
  | 'conditional'  // 조건형 간소화
  | 'honorific'    // 존댓말 간소화
  | 'solution'     // 해결 중심 표현 (Focus on Solutions)
  | 'terminology'  // 서비스 용어 교정
  | 'jargon';      // 전문용어/한자어 감지

interface ReplacementRule {
  id: string;
  description: string;
  category: RuleCategory;
  pattern: RegExp;
  replace: (match: RegExpMatchArray) => string;
}

interface TerminologyIssue {
  deprecated: string;
  approved: string;
  category: string;
}

interface PeriodIssue {
  type: 'unnecessary_period' | 'missing_period';
  description: string;
}

interface KeywordStat {
  word: string;
  count: number;
}

interface NodeAnalysis {
  nodeId: string;
  name: string;
  originalText: string;
  suggestedText: string;
  sentenceType: SentenceType;
  emotion: EmotionTone;
  keywords: KeywordStat[];
  appliedRuleIds: string[];
  terminologyIssues: TerminologyIssue[];
  periodIssue: PeriodIssue | null;
  jargonWarnings: string[];
}

interface ToneProfileSummary {
  totalNodes: number;
  analyzedNodes: number;
  sentenceTypeCount: Record<SentenceType, number>;
  emotionCount: Record<EmotionTone, number>;
  topKeywords: KeywordStat[];
  totalTerminologyIssues: number;
  totalPeriodIssues: number;
  totalJargonWarnings: number;
}

interface AnalysisResult {
  nodes: NodeAnalysis[];
  summary: ToneProfileSummary;
}

// UI <-> plugin 메시지 타입
type UiToPluginMessage =
  | { type: 'analyze' }
  | {
      type: 'apply';
      payload: { targets: { nodeId: string; newText: string }[] };
    };

type PluginToUiMessage =
  | { type: 'analysis-result'; payload: AnalysisResult }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string };


// ========== GLN UX Writing 패턴 정의 ==========
// 출처: GLN UX & Communication Standards v1.0
// 원칙: 친근한 어휘 사용 · 구어체(비격식체) · 해결 중심 표현

/**
 * 치환 규칙 원본 배열 (순서 중요: 구체적 패턴 → 일반적 패턴)
 *
 * [적용 원칙]
 * 1. 구어체(비격식체) 사용: ~니다 → ~요 (단, 격식 맥락 예외 허용)
 * 2. 전문 용어 · 한자어 지양: 일상 표현 우선
 * 3. 해결 중심 표현: 문제보다 해결 방법 제시
 * 4. 명확하고 직관적인 메시지 제공
 */
const UX_TONE_SOURCE: Array<{
  pattern: string;
  replacement: string;
  description: string;
  category: RuleCategory;
}> = [
  // ── [직접 표현 개선] 해보세요 계열 ─────────────────────────
  { pattern: '확인해보세요',   replacement: '확인해 주세요', description: '친근한 어조',   category: 'tone' },
  { pattern: '이용해보세요',   replacement: '이용해 주세요', description: '간결한 표현',   category: 'tone' },
  { pattern: '참여해보세요',   replacement: '참여하기',      description: '직접적 유도',   category: 'tone' },
  { pattern: '신청해보세요',   replacement: '신청하기',      description: '간편함 강조',   category: 'tone' },
  { pattern: '문의해보세요',   replacement: '문의하기',      description: '쉬운 접근',     category: 'tone' },
  { pattern: '해보세요',       replacement: '해 주세요',     description: '친근한 요청',   category: 'tone' },

  // ── [해결 중심 표현] Focus on Solutions ─────────────────────
  // GLN Voice Principles: "문제보다 해결 먼저"
  { pattern: '오류가 발생했습니다', replacement: '잠시 후 다시 시도해 주세요',    description: '해결 중심', category: 'solution' },
  { pattern: '오류가 발생했어요',   replacement: '잠시 후 다시 시도해 주세요',    description: '해결 중심', category: 'solution' },
  { pattern: '오류입니다',          replacement: '다시 시도해 주세요',             description: '해결 중심', category: 'solution' },
  { pattern: '실패했습니다',        replacement: '다시 시도해 주세요',             description: '해결 중심', category: 'solution' },
  { pattern: '불가합니다',          replacement: '할 수 없어요',                   description: '친근한 표현', category: 'solution' },
  { pattern: '불가능합니다',        replacement: '할 수 없어요',                   description: '친근한 표현', category: 'solution' },
  { pattern: '불가해요',            replacement: '할 수 없어요',                   description: '친근한 표현', category: 'solution' },
  { pattern: '취급하지 않습니다',   replacement: '지원하지 않아요',                description: '친근한 표현', category: 'solution' },
  { pattern: '지원하지 않습니다',   replacement: '지원하지 않아요',                description: '친근한 표현', category: 'solution' },

  // ── [명령형 → 정중한 요청] 긴 패턴 우선 ──────────────────────
  { pattern: '하시기 바랍니다',         replacement: '해 주세요',     description: '간결한 요청', category: 'command' },
  { pattern: '하여 주시기 바랍니다',    replacement: '해 주세요',     description: '간결한 요청', category: 'command' },
  { pattern: '하여주시기 바랍니다',     replacement: '해 주세요',     description: '간결한 요청', category: 'command' },
  { pattern: '이용하시기 바랍니다',     replacement: '이용해 주세요', description: '간결한 요청', category: 'command' },
  { pattern: '확인하시기 바랍니다',     replacement: '확인해 주세요', description: '간결한 요청', category: 'command' },
  { pattern: '입력하시기 바랍니다',     replacement: '입력해 주세요', description: '간결한 요청', category: 'command' },
  { pattern: '해주십시오',              replacement: '해 주세요',     description: '정중한 요청', category: 'command' },
  { pattern: '해 주십시오',             replacement: '해 주세요',     description: '정중한 요청', category: 'command' },
  { pattern: '확인하십시오',            replacement: '확인해 주세요', description: '정중한 요청', category: 'command' },
  { pattern: '입력하십시오',            replacement: '입력해 주세요', description: '정중한 요청', category: 'command' },
  { pattern: '선택하십시오',            replacement: '선택해 주세요', description: '정중한 요청', category: 'command' },
  { pattern: '이용하십시오',            replacement: '이용해 주세요', description: '정중한 요청', category: 'command' },
  { pattern: '하십시오',                replacement: '해 주세요',     description: '정중한 요청', category: 'command' },
  { pattern: '주십시오',                replacement: '주세요',        description: '정중한 요청', category: 'command' },

  // ── [존댓말 간소화] 구체적 동사 패턴 ─────────────────────────
  { pattern: '확인하세요',  replacement: '확인해 주세요', description: '구체적 요청', category: 'honorific' },
  { pattern: '이용하세요',  replacement: '이용해 주세요', description: '구체적 요청', category: 'honorific' },
  { pattern: '입력하세요',  replacement: '입력해 주세요', description: '구체적 요청', category: 'honorific' },
  { pattern: '선택하세요',  replacement: '선택해 주세요', description: '구체적 요청', category: 'honorific' },
  { pattern: '등록하세요',  replacement: '등록해 주세요', description: '구체적 요청', category: 'honorific' },
  { pattern: '참여하세요',  replacement: '참여하기',      description: '직접적 유도', category: 'honorific' },
  { pattern: '신청하세요',  replacement: '신청하기',      description: '간편함 강조', category: 'honorific' },

  // ── [조건형 간소화] ───────────────────────────────────────────
  { pattern: '하셨다면', replacement: '했다면', description: '간결한 조건', category: 'conditional' },
  { pattern: '이시면',   replacement: '이면',   description: '간결한 조건', category: 'conditional' },
  { pattern: '하시면',   replacement: '하면',   description: '간결한 조건', category: 'conditional' },
  { pattern: '하셔야',   replacement: '해야',   description: '간결한 조건', category: 'conditional' },
  { pattern: '하셔서',   replacement: '해서',   description: '간결한 조건', category: 'conditional' },

  // ── [격식체 → 비격식체] 긴 패턴 우선 배치 ─────────────────────
  // GLN 기준: ~니다 → ~요 (구어체 원칙)
  { pattern: '하겠습니다', replacement: '할게요',   description: '비격식체', category: 'formal' },
  { pattern: '됩니다',     replacement: '돼요',      description: '비격식체', category: 'formal' },
  { pattern: '있습니다',   replacement: '있어요',    description: '비격식체', category: 'formal' },
  { pattern: '없습니다',   replacement: '없어요',    description: '비격식체', category: 'formal' },
  { pattern: '했습니다',   replacement: '했어요',    description: '비격식체', category: 'formal' },
  { pattern: '드립니다',   replacement: '드려요',    description: '비격식체', category: 'formal' },
  { pattern: '바랍니다',   replacement: '바라요',    description: '비격식체', category: 'formal' },
  { pattern: '겠습니다',   replacement: '겠어요',    description: '비격식체', category: 'formal' },
  { pattern: '았습니다',   replacement: '았어요',    description: '비격식체', category: 'formal' },
  { pattern: '었습니다',   replacement: '었어요',    description: '비격식체', category: 'formal' },
  { pattern: '합니다',     replacement: '해요',      description: '비격식체', category: 'formal' },
  { pattern: '입니다',     replacement: '이에요',    description: '비격식체', category: 'formal' }, // 마지막 배치
];

/**
 * GLN 서비스 용어집 - 사용 지양 용어 → 대표 용어
 * 출처: GLN UX & Communication Standards v1.0 - Service Terminology
 */
const SERVICE_TERMINOLOGY_RULES: Array<{
  deprecated: string;
  approved: string;
  category: string;
}> = [
  // 가입/인증
  { deprecated: 'KYC',           approved: '본인 인증',          category: '가입/인증' },
  { deprecated: 'CDD',           approved: '추가 정보',          category: '가입/인증' },
  { deprecated: '고객확인',      approved: '본인 인증',          category: '가입/인증' },
  { deprecated: '고객확인의무',  approved: '본인 인증',          category: '가입/인증' },
  { deprecated: '실명확인증표',  approved: '신분증',             category: '가입/인증' },
  { deprecated: '실명확인',      approved: '본인 확인',          category: '가입/인증' },
  { deprecated: '다시시도하기',  approved: '인증번호 다시 받기', category: '가입/인증' },
  { deprecated: '다시 보내기',   approved: '인증번호 다시 받기', category: '가입/인증' },
  { deprecated: '다시 촬영하기', approved: '다시 찍기',          category: '가입/인증' },
  { deprecated: '신분증 촬영',   approved: '촬영하기',           category: '가입/인증' },
  { deprecated: '대한민국 여권', approved: '한국 여권',          category: '가입/인증' },
  { deprecated: '거래목적',      approved: '가입목적',           category: '가입/인증' },
  // 금융거래
  { deprecated: '국가선택',   approved: '지역선택',     category: '금융거래' },
  { deprecated: '해외결제',   approved: '해외 QR결제',  category: '금융거래' },
  { deprecated: 'G머니',      approved: 'GLN머니',      category: '금융거래' },
  { deprecated: '띳머니',     approved: 'GLN머니',      category: '금융거래' },
  { deprecated: 'QR코드',     approved: 'QR',           category: '금융거래' },
  { deprecated: '코드보여주기', approved: 'QR / 바코드', category: '금융거래' },
  { deprecated: '사용방법',   approved: '결제방법',     category: '금융거래' },
  { deprecated: '결제처',     approved: '결제 브랜드',  category: '금융거래' },
  { deprecated: '결제매장',   approved: '사용처',       category: '금융거래' },
  { deprecated: '가맹점',     approved: '사용처',       category: '금융거래' },
  { deprecated: '출금금액',   approved: '출금액',       category: '금융거래' },
  // 마케팅
  { deprecated: '캐쉬백', approved: '캐시백', category: '마케팅' },
  // 회원정보
  { deprecated: '회원탈퇴',        approved: '탈퇴하기',                  category: '회원정보' },
  { deprecated: '탈회',            approved: '탈퇴하기',                  category: '회원정보' },
  { deprecated: '고객정보취급방침', approved: '약관 및 개인정보 처리 동의', category: '회원정보' },
  // 고객안내
  { deprecated: '카카오톡 문의', approved: '카카오톡 문의하기', category: '고객안내' },
  // 기타/설정
  { deprecated: '전체메뉴', approved: '전체',    category: '설정' },
  { deprecated: '앱 푸쉬',  approved: '앱알림',  category: '설정' },
  { deprecated: '앱푸시',   approved: '앱알림',  category: '설정' },
  { deprecated: '링크복사', approved: '복사하기', category: '설정' },
];

/**
 * 전문용어 · 한자어 감지 목록
 * 출처: GLN Voice Principles "전문 용어, 한자어 지양"
 */
const JARGON_LIST: string[] = [
  '선불전자지급수단', '전자지급결제대행', '소액해외송금업자',
  '고객확인의무', '이행', '공인인증서', '전자서명',
  '출금이체동의', 'PG', 'MPM', 'CPM', 'ARS',
  '실명확인증표', '외국인등록번호', '거소신고번호',
];

// ========== 치환 규칙 배열 빌드 ==========

const REPLACEMENT_RULES: ReplacementRule[] = UX_TONE_SOURCE.map((item, index) => ({
  id: `rule-${item.category}-${index}`,
  description: item.description,
  category: item.category,
  pattern: new RegExp(item.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
  replace: () => item.replacement,
}));

// 서비스 용어 규칙도 자동 치환 대상에 포함 (안전한 용어만)
const SAFE_TERMINOLOGY_AUTO_REPLACE = SERVICE_TERMINOLOGY_RULES.filter(r =>
  ['캐쉬백', '앱 푸쉬', '앱푸시', '탈회', '링크복사', '전체메뉴', '가맹점', '결제매장'].includes(r.deprecated)
);

const TERMINOLOGY_RULES: ReplacementRule[] = SAFE_TERMINOLOGY_AUTO_REPLACE.map((item, index) => ({
  id: `term-${index}`,
  description: `용어 교정: "${item.deprecated}" → "${item.approved}"`,
  category: 'terminology' as RuleCategory,
  pattern: new RegExp(item.deprecated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
  replace: () => item.approved,
}));

const ALL_RULES: ReplacementRule[] = [...REPLACEMENT_RULES, ...TERMINOLOGY_RULES];


// ========== 분석 유틸 ==========

const KOREAN_STOPWORDS = [
  '그리고', '하지만', '또는', '또', '이것', '저것', '것', '에서', '으로',
  '에는', '을', '를', '이', '가', '은', '는', '에', '도', '만', '의', '로'
];

/**
 * 문장 타입 분석
 * GLN Contextual Patterns 기반 분류
 */
function detectSentenceType(text: string): SentenceType {
  const trimmed = text.trim();
  if (!trimmed) return 'unknown';

  if (trimmed.endsWith('?')) return 'interrogative';

  if (/(하세요|해 주세요|해주세요|해 보세요|해보세요|하십시오|하기|주세요|볼까요|할까요)(\s*)$/.test(trimmed)) {
    return 'imperative';
  }

  if (/(니다|이에요|예요|해요|돼요|입니다|됩니다|있어요|있습니다|어요|아요|겠어요)\.?$/.test(trimmed)) {
    return 'declarative';
  }

  return 'unknown';
}

/**
 * 감정 톤 분석
 * GLN Emotion Keywords 기반
 */
function analyzeEmotion(texts: string[]): EmotionTone {
  const emotionKeywords: Record<Exclude<EmotionTone, 'neutral'>, string[]> = {
    enthusiastic: ['설렘', '최고', '특가', '대박', '놀라운', '환상', '완벽', '!', '특별', '혜택'],
    friendly:     ['함께', '나만의', '여러분', '친구', '가족', '편안', '따뜻', '쉽게', '빠르게'],
    professional: ['서비스', '품질', '전문', '안전', '신뢰', '보장', '관리', '인증', '금융'],
    playful:      ['재미', '즐거운', 'ㅋ', '귀여운', '신나는', '웃음', '놀이'],
  };

  const scores: Record<EmotionTone, number> = {
    neutral: 0, enthusiastic: 0, friendly: 0, professional: 0, playful: 0
  };

  const joined = texts.join(' ');
  if (!joined.trim()) return 'neutral';

  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    for (const kw of keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = joined.match(new RegExp(escaped, 'g'));
      if (matches) scores[emotion as EmotionTone] += matches.length;
    }
  }

  let best: EmotionTone = 'neutral';
  let bestScore = 0;
  (Object.keys(scores) as EmotionTone[]).forEach((key) => {
    if (scores[key] > bestScore) { best = key; bestScore = scores[key]; }
  });

  return bestScore === 0 ? 'neutral' : best;
}

/**
 * 키워드 추출 및 빈도 분석
 */
function extractKeywords(text: string): KeywordStat[] {
  const normalized = text
    .replace(/[.,!?~…·/\\()[\]{}"""'']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [];

  const freq = new Map<string, number>();
  for (const word of normalized.split(' ').filter(w => !!w)) {
    if (KOREAN_STOPWORDS.includes(word)) continue;
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  const stats: KeywordStat[] = [];
  freq.forEach((count, word) => stats.push({ word, count }));
  return stats.sort((a, b) => b.count - a.count);
}

/**
 * GLN 서비스 용어 검사
 * 사용 지양 용어를 탐지하고 권장 용어를 반환
 */
function detectTerminologyIssues(text: string): TerminologyIssue[] {
  const issues: TerminologyIssue[] = [];
  for (const rule of SERVICE_TERMINOLOGY_RULES) {
    const escaped = rule.deprecated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(escaped).test(text)) {
      issues.push({
        deprecated: rule.deprecated,
        approved: rule.approved,
        category: rule.category,
      });
    }
  }
  return issues;
}

/**
 * GLN 마침표 사용 기준 검사
 * 출처: GLN Communication Standards "마침표 사용 기준"
 *
 * 생략: 버튼 문구, Toast, Modal 제목, 즉각 행동 유도 문구
 * 사용: 긴 설명 문장, 2문장 이상 이어지는 경우, 공지사항/FAQ
 */
function checkPeriodUsage(text: string): PeriodIssue | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const endsWithPeriod = trimmed.endsWith('.');

  // 즉각 행동 유도 / 버튼성 어미 패턴 (마침표 생략 대상)
  const actionEndingPattern = /(하기|주세요|해요|돼요|있어요|없어요|이에요|예요|볼까요|할까요|세요|했어요|겠어요|겠습니다)\.?$/;
  const isActionText = actionEndingPattern.test(trimmed);
  const isShortText = trimmed.length <= 40;

  if (endsWithPeriod && isShortText && isActionText) {
    return {
      type: 'unnecessary_period',
      description: '버튼/토스트/행동 유도 문구에는 마침표를 생략해 주세요 (GLN 마침표 기준)',
    };
  }

  // 설명형 장문 문장인데 마침표가 없는 경우
  const periodCount = (trimmed.match(/[.]/g) || []).length;
  const isLongDescriptive = trimmed.length > 60 && !endsWithPeriod && periodCount === 0;
  const hasMultipleClauses = /이고|이며|또한|그리고|하지만|경우에는|때에는/.test(trimmed);

  if (isLongDescriptive && hasMultipleClauses) {
    return {
      type: 'missing_period',
      description: '긴 설명 문구에는 마침표를 사용해 주세요 (GLN 마침표 기준)',
    };
  }

  return null;
}

/**
 * GLN 전문용어 · 한자어 감지
 * 출처: GLN Voice Principles "전문 용어, 한자어 지양"
 */
function detectJargon(text: string): string[] {
  return JARGON_LIST.filter(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped).test(text);
  });
}

/**
 * UX 톤 규칙 전체 적용
 * 모든 REPLACEMENT_RULES(톤+용어) 순차 적용
 */
function applyUxToneRules(text: string): { result: string; appliedRuleIds: string[] } {
  let current = text;
  const appliedRuleIds = new Set<string>();

  for (const rule of ALL_RULES) {
    const before = current;
    current = current.replace(rule.pattern, (match: string) => {
      appliedRuleIds.add(rule.id);
      return rule.replace([match] as unknown as RegExpMatchArray);
    });
    if (before !== current) appliedRuleIds.add(rule.id);
  }

  return { result: current, appliedRuleIds: Array.from(appliedRuleIds) };
}


// ========== Figma 문서 탐색 유틸 ==========

function collectTextNodes(node: SceneNode, result: TextNode[]): void {
  if (node.type === 'TEXT') result.push(node);
  if ('children' in node) {
    for (const child of node.children as readonly SceneNode[]) {
      collectTextNodes(child as SceneNode, result);
    }
  }
}

async function loadFontsForNodes(nodes: TextNode[]): Promise<void> {
  const serializedFonts = new Set<string>();
  for (const node of nodes) {
    if (node.hasMissingFont || node.fontName === figma.mixed) continue;
    serializedFonts.add(JSON.stringify(node.fontName as FontName));
  }
  await Promise.all(
    [...serializedFonts].map(s => figma.loadFontAsync(JSON.parse(s) as FontName))
  );
}


// ========== 선택 영역 분석 ==========

function analyzeSelection(nodes: TextNode[]): AnalysisResult {
  const analyses: NodeAnalysis[] = [];

  const sentenceTypeCount: Record<SentenceType, number> = {
    declarative: 0, interrogative: 0, imperative: 0, unknown: 0,
  };
  const emotionCount: Record<EmotionTone, number> = {
    neutral: 0, enthusiastic: 0, friendly: 0, professional: 0, playful: 0,
  };

  let totalTerminologyIssues = 0;
  let totalPeriodIssues = 0;
  let totalJargonWarnings = 0;
  const globalKeywordMap = new Map<string, number>();

  for (const node of nodes) {
    const text = node.characters;

    // 1. UX 톤 규칙 적용 → 제안 텍스트 생성
    const { result: suggestedText, appliedRuleIds } = applyUxToneRules(text);

    // 2. 문장 타입 / 감정 분석
    const sentenceType = detectSentenceType(text);
    const emotion = analyzeEmotion([text]);
    const keywords = extractKeywords(text);

    // 3. GLN 서비스 용어 검사
    const terminologyIssues = detectTerminologyIssues(text);

    // 4. 마침표 사용 기준 검사
    const periodIssue = checkPeriodUsage(text);

    // 5. 전문용어 · 한자어 감지
    const jargonWarnings = detectJargon(text);

    // 집계
    sentenceTypeCount[sentenceType] += 1;
    emotionCount[emotion] += 1;
    totalTerminologyIssues += terminologyIssues.length;
    if (periodIssue) totalPeriodIssues += 1;
    totalJargonWarnings += jargonWarnings.length;

    for (const kw of keywords) {
      globalKeywordMap.set(kw.word, (globalKeywordMap.get(kw.word) ?? 0) + kw.count);
    }

    analyses.push({
      nodeId: node.id,
      name: node.name,
      originalText: text,
      suggestedText,
      sentenceType,
      emotion,
      keywords,
      appliedRuleIds,
      terminologyIssues,
      periodIssue,
      jargonWarnings,
    });
  }

  const globalKeywords: KeywordStat[] = [];
  globalKeywordMap.forEach((count, word) => globalKeywords.push({ word, count }));
  globalKeywords.sort((a, b) => b.count - a.count);

  const summary: ToneProfileSummary = {
    totalNodes: nodes.length,
    analyzedNodes: analyses.length,
    sentenceTypeCount,
    emotionCount,
    topKeywords: globalKeywords.slice(0, 50),
    totalTerminologyIssues,
    totalPeriodIssues,
    totalJargonWarnings,
  };

  return { nodes: analyses, summary };
}


// ========== 플러그인 진입점 & 메시지 핸들링 ==========

figma.showUI(__html__, { width: 420, height: 520 });

async function handleAnalyze(): Promise<void> {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    const message: PluginToUiMessage = {
      type: 'error',
      message: '텍스트 레이어를 선택한 후 다시 시도해 주세요.',
    };
    figma.ui.postMessage(message);
    return;
  }

  const textNodes: TextNode[] = [];
  for (const node of selection) collectTextNodes(node as SceneNode, textNodes);

  if (textNodes.length === 0) {
    const message: PluginToUiMessage = {
      type: 'error',
      message: '선택된 객체 안에 텍스트가 없어요.',
    };
    figma.ui.postMessage(message);
    return;
  }

  const analysis = analyzeSelection(textNodes);
  figma.ui.postMessage({ type: 'analysis-result', payload: analysis } as PluginToUiMessage);
}

async function handleApply(targets: { nodeId: string; newText: string }[]): Promise<void> {
  if (!targets.length) {
    figma.ui.postMessage({ type: 'info', message: '적용할 항목이 선택되지 않았어요.' } as PluginToUiMessage);
    return;
  }

  const nodesToLoad: TextNode[] = [];
  for (const target of targets) {
    const node = figma.getNodeById(target.nodeId);
    if (node && node.type === 'TEXT') nodesToLoad.push(node as TextNode);
  }

  if (!nodesToLoad.length) {
    figma.ui.postMessage({ type: 'error', message: '선택된 텍스트 노드를 찾을 수 없어요.' } as PluginToUiMessage);
    return;
  }

  await loadFontsForNodes(nodesToLoad);

  let changedCount = 0;
  for (const target of targets) {
    const node = figma.getNodeById(target.nodeId);
    if (!node || node.type !== 'TEXT') continue;
    const textNode = node as TextNode;
    if (textNode.fontName === figma.mixed || textNode.hasMissingFont) continue;
    if (textNode.characters !== target.newText) {
      textNode.characters = target.newText;
      changedCount += 1;
    }
  }

  const message: PluginToUiMessage = {
    type: 'info',
    message:
      changedCount === 0
        ? '변경된 내용이 없어요.'
        : `총 ${changedCount}개의 텍스트에 GLN UX 톤을 적용했어요.`,
  };
  figma.ui.postMessage(message);
}

figma.ui.onmessage = async (rawMsg: UiToPluginMessage) => {
  if (rawMsg.type === 'analyze') await handleAnalyze();
  else if (rawMsg.type === 'apply') await handleApply(rawMsg.payload.targets);
};
