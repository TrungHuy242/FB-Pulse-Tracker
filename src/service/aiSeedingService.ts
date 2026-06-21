/**
 * AI Seeding Service - Gemini API Integration
 * 
 * Sử dụng Gemini để generate seeding content tự động
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

import type { SeedingCategory, SeedingGroup } from "@/types/seeding";

// ── Config ─────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.0-flash";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  systemInstruction: `# ROLE: AI SEEDING MANAGER FOR FACEBOOK COMMUNITY

Bạn là một AI Agent chuyên vận hành seeding cộng đồng cho lĩnh vực học tiếng Trung.

Bạn không phải AI copywriter.
Bạn phải suy nghĩ như một người đang quản lý nhiều tài khoản Facebook và tạo tương tác tự nhiên.

Nhiệm vụ:

1. Tạo bài viết giả lập
2. Tạo comment tương tác
3. Tạo comment kéo member về nhóm
4. Chống trùng nội dung
5. Học phong cách từ lịch sử


====================
WORKFLOW BẮT BUỘC
====================

Mỗi campaign gồm:

POST
↓
COMMENTS
↓
REDIRECT COMMENTS


Không được gộp 3 phần.


====================
1. GENERATE POST
====================

Mục tiêu:
Tạo bài viết giống người thật đăng trong group.

Người đăng thường có tâm lý:

- đang cần tìm
- đang phân vân
- cần người tư vấn
- muốn xin review
- muốn nghe kinh nghiệm


Phong cách:

Dùng:
- mn
- b
- tui
- em
- mình
- k
- rcm
- ib


Ví dụ:

"Mn cho em hỏi học tiếng Trung online ở đâu ổn với ạ"

"Em muốn tìm lớp HSK4 mà chưa biết chọn chỗ nào"

"Tui mới bắt đầu học tiếng Trung, ai có kinh nghiệm chỉ tui với"


Không được:

"Bạn đang có nhu cầu học tiếng Trung? Hãy tham khảo..."

Sai vì quá quảng cáo.


====================
2. GENERATE COMMENTS
====================

Sau mỗi post tạo 5 comment.

Mục đích:
Tạo cảm giác bài viết có người quan tâm.


Comment phải chia dạng:


A. Người hỏi giống nhau

Ví dụ:
"Tui cũng đang tìm nè, hóng ké"


B. Người chia sẻ

Ví dụ:
"Tui thấy quan trọng là gv sửa phát âm á"


C. Người xin review

Ví dụ:
"Ai học rồi cho xin ít review với"


D. Người hỏi thêm

Ví dụ:
"Có lớp tối không mn"


Không được comment:
"Bạn nên đăng ký trung tâm X"


====================
3. REDIRECT MEMBER
====================

Phần này quan trọng.

Không lấy comment mồi.

Phải tạo riêng.


Mục tiêu:
Sau khi đọc bài viết,
chọn group phù hợp.


Mapping:


Nếu bài:
- tìm khóa học
- tìm trung tâm
- tìm giáo viên

=> group REVIEW


Nếu bài:
- online
- 1:1
- lịch học

=> group ONLINE


Nếu bài:
- HSK
- thi
- luyện đề

=> group HSK


Nếu bài:
- tài liệu
- app
- tự học

=> group RESOURCE


Sau đó tạo comment:


Cấu trúc:

[Câu chia sẻ thật]
+
[Câu gợi ý]
+
[GROUP LINK]


Ví dụ:

"Tui cũng từng tìm lớp nên thấy quan trọng là chọn gv hợp á. B vào nhóm này hỏi thêm review thử nè:
{group_url}"


BẮT BUỘC:
redirect phải chứa link.


Nếu database không có group:
trả về:

"NO_GROUP_FOUND"


====================
4. STYLE ENGINE
====================

Mỗi lần generate:

Kiểm tra lịch sử.

Không lặp:

- câu mở đầu
- ý tưởng
- cấu trúc


Ví dụ:

Đã dùng:
"Mn cho em hỏi..."

Lần sau đổi:

"Có ai từng..."

hoặc:

"Tui đang tính..."


====================
5. OUTPUT JSON
====================


{
 campaign:{
   title:"",
   category:"",
   post:"",

   comments:[
    "",
    "",
    "",
    "",
    ""
   ],

   redirect:{
      group_name:"",
      group_url:"",
      content:""
   }
 }
}


====================
6. MEMORY
====================

Nhận thêm:

previous_posts

previous_comments


Dùng để tránh trùng.


Bạn là AI Seeding Operator.
Mục tiêu không phải viết văn hay.
Mục tiêu là tạo cảm giác:
"đây là người thật đang hỏi và tương tác".`,
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface AIGeneratedCampaign {
  title: string;
  category: SeedingCategory;
  post: string;
  comments: string[];
  redirect: {
    group_name: string;
    group_url: string;
    content: string;
  };
}

interface GenerateCampaignInput {
  category: SeedingCategory;
  topic?: string;
  targetGroup?: SeedingGroup;
  previousPosts?: string[];
  previousComments?: string[];
}

// ── Category Descriptions ────────────────────────────────────────────────────────

const CATEGORY_DESCRIPTIONS: Record<SeedingCategory, string> = {
  "tìm khóa học": "người đang tìm kiếm khóa học tiếng Trung phù hợp, muốn xin review và tư vấn",
  "tìm trung tâm": "người đang phân vân giữa các trung tâm, muốn biết trung tâm nào tốt",
  "tìm lớp": "người cần tìm lớp học với lịch trình cụ thể (buổi tối, cuối tuần...)",
  "tìm gia sư": "người cần gia sư 1-1 để học cá nhân",
  "học online": "người muốn học online vì đi làm, không có thời gian đến trung tâm",
  "hỏi tài liệu": "người cần tìm sách, giáo trình, tài liệu học tiếng Trung",
  "hỏi app/web": "người muốn tìm app hoặc website hỗ trợ học tiếng Trung",
  "hỏi HSK": "người cần thông tin về thi HSK, lộ trình ôn thi, đăng ký thi",
  "hỏi kinh nghiệm học": "người mới bắt đầu hoặc đang gặp khó khăn, cần lời khuyên",
  "tự học": "người muốn tự học ở nhà, cần lộ trình và phương pháp",
};

// ── AI Service ─────────────────────────────────────────────────────────────────

export const aiSeedingService = {
  /**
   * Generate a complete seeding campaign using Gemini AI
   */
  async generateCampaign(input: GenerateCampaignInput): Promise<AIGeneratedCampaign> {
    const categoryDesc = CATEGORY_DESCRIPTIONS[input.category] || "người đang hỏi về tiếng Trung";
    
    // Build context for avoiding duplicates
    let avoidContext = "";
    if (input.previousPosts && input.previousPosts.length > 0) {
      avoidContext += `\n\nCÁC BÀI ĐÃ DÙNG (KHÔNG TRÙNG):\n${input.previousPosts.slice(-10).join("\n")}`;
    }
    if (input.previousComments && input.previousComments.length > 0) {
      avoidContext += `\n\nCÁC COMMENT ĐÃ DÙNG (KHÔNG TRÙNG):\n${input.previousComments.slice(-15).join("\n")}`;
    }

    const targetGroupContext = input.targetGroup 
      ? `\n\nGROUP ĐỂ REDIRECT:\n- Name: ${input.targetGroup.name}\n- URL: ${input.targetGroup.url}\n- Category: ${input.targetGroup.category}`
      : "\n\n(Không có group trong database - redirect sẽ là NO_GROUP_FOUND)";

    const prompt = `Hãy tạo một campaign seeding hoàn chỉnh cho Facebook group tiếng Trung.

CHỦ ĐỀ CẦN SEEDING: ${categoryDesc}
${input.topic ? `TỪ KHÓA: ${input.topic}` : ""}
${avoidContext}
${targetGroupContext}

YÊU CẦU:
1. Bài viết phải tự nhiên như người thật, dùng tiếng Việt trẻ, có dấu câu đúng chính tả
2. Tạo ĐÚNG 5 comment mồi, chia đều các dạng: hỏi giống, chia sẻ, xin review, hỏi thêm
3. Redirect comment phải tự nhiên, có gắn link group (nếu có)
4. KHÔNG TRÙNG với các bài/comment đã dùng
5. Trả về JSON đúng format

TRẢ VỀ JSON (chỉ JSON, không có gì khác):`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Không parse được JSON từ Gemini");
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate và transform
      const campaign: AIGeneratedCampaign = {
        title: parsed.campaign?.title || parsed.title || `Seeding ${input.category}`,
        category: parsed.campaign?.category || input.category,
        post: parsed.campaign?.post || parsed.post || "",
        comments: parsed.campaign?.comments || parsed.comments || [],
        redirect: {
          group_name: parsed.campaign?.redirect?.group_name || input.targetGroup?.name || "",
          group_url: parsed.campaign?.redirect?.group_url || input.targetGroup?.url || "",
          content: parsed.campaign?.redirect?.content || "NO_GROUP_FOUND",
        },
      };
      
      // Ensure exactly 5 comments
      while (campaign.comments.length < 5) {
        campaign.comments.push(`Hóng bài này, đang cần lắm luôn!`);
      }
      campaign.comments = campaign.comments.slice(0, 5);
      
      return campaign;
      
    } catch (error) {
      console.error("Gemini API Error:", error);
      
      // Fallback to template-based if AI fails
      return this.generateFallbackCampaign(input);
    }
  },

  /**
   * Generate multiple campaigns for daily use
   */
  async generateDailyCampaigns(count: number = 4): Promise<AIGeneratedCampaign[]> {
    const categories: SeedingCategory[] = [
      "tìm khóa học",
      "học online",
      "hỏi HSK",
      "hỏi kinh nghiệm học",
    ];
    
    const campaigns: AIGeneratedCampaign[] = [];
    
    for (let i = 0; i < Math.min(count, categories.length); i++) {
      const campaign = await this.generateCampaign({
        category: categories[i],
        previousPosts: campaigns.map(c => c.post),
        previousComments: campaigns.flatMap(c => c.comments),
      });
      campaigns.push(campaign);
    }
    
    return campaigns;
  },

  /**
   * Fallback khi AI fails - dùng template có sẵn
   */
  generateFallbackCampaign(input: GenerateCampaignInput): AIGeneratedCampaign {
    const templates: Record<SeedingCategory, { post: string; comments: string[] }> = {
      "tìm khóa học": {
        post: "Em muốn tìm lớp tiếng Trung online cho người mới bắt đầu ạ, mn có gợi ý gì không?",
        comments: [
          "tui cũng đang tìm nè, hóng ké",
          "mk cũng muốn tìm, m.n có gợi ý gì không",
          "hóng bài này, đang cần lắm",
          "tui học ở đâu đó rcm cho mn với",
          "cảm ơn bạn đã hỏi, mk cũng cần thông tin này",
        ],
      },
      "tìm trung tâm": {
        post: "Trung tâm nào dạy tiếng Trung uy tín vậy mn? Ai từng học ở đâu chỉ mình với",
        comments: [
          "trung tâm nào chất lượng mà giá cả hợp lý?",
          "mk tìm được chỗ nào đó rcm cho mn",
          "học ở trung tâm vs gia sư cái nào tốt hơn?",
          "ai có review trung tâm nào không?",
          "tui đang phân vân giữa vài chỗ",
        ],
      },
      "tìm lớp": {
        post: "Em đang tìm lớp tiếng Trung buổi tối, mn giúp em với. Tui ở khu vực quận mấy cũng được",
        comments: [
          "tui cũng cần tìm lớp buổi tối",
          "lớp nào mở vào cuối tuần không?",
          "có lớp nào gần quận mấy không?",
          "ai biết lớp nào tốt chỉ mk với",
          "mk cũng đang tìm, hóng ké",
        ],
      },
      "tìm gia sư": {
        post: "Cần tìm gia sư tiếng Trung 1-1, ai giới thiệu với. Tui muốn học phát âm chuẩn",
        comments: [
          "cần gia sư 1-1 lắm luôn",
          "tui cũng đang tìm, ai biết giới thiệu",
          "gia sư online giá bao nhiêu vậy mn?",
          "có gia sư nào dạy buổi tối không ạ?",
          "tui muốn học phát âm vì tự học không được",
        ],
      },
      "học online": {
        post: "Học tiếng Trung online có hiệu quả không mn? Tui đi làm không có thời gian đi học trung tâm",
        comments: [
          "tui học online thấy ok lắm, tiện mà tiết kiệm thời gian",
          "online thì quan trọng gv có tâm với hs không",
          "app nào tốt vậy bạn ơi?",
          "mk đang dùng app đó, thấy ổn",
          "học online cần tự giác lắm, ai có tip gì không?",
        ],
      },
      "hỏi tài liệu": {
        post: "Sách nào học pinyin cho người mới tốt vậy? Ai có tài liệu học tiếng Trung share mình với",
        comments: [
          "mk cũng đang cần tài liệu, ai share với",
          "sách pinyin nào tốt nhỉ?",
          "tui muốn tìm tài liệu ôn HSK, ai có không?",
          "tài liệu free ở đâu vậy?",
          "ai có sách giáo khoa tiếng Trung share mk với",
        ],
      },
      "hỏi app/web": {
        post: "App học tiếng Trung nào các bạn đang dùng? Ngoài Duolingo còn app nào hay không?",
        comments: [
          "mk dùng app đó, thấy ổn đấy",
          "ngoài app này còn cái nào hay không?",
          "tui đang dùng và thấy hiệu quả",
          "app có free không vậy?",
          "web nào luyện nghe tốt nhỉ?",
        ],
      },
      "hỏi HSK": {
        post: "HSK 3 mất bao lâu để ôn xong vậy mn? Thi HSK ở đâu vậy? Lịch thi tháng này có không?",
        comments: [
          "mk cũng định thi HSK 3, đang lo lắm",
          "HSK 3 ôn bao lâu là đủ vậy?",
          "ai có kinh nghiệm thi HSK chia sẻ với",
          "tui thi HSK 4 rồi, cần chuẩn bị gì không?",
          "điểm pass HSK 4 là bao nhiêu vậy?",
        ],
      },
      "hỏi kinh nghiệm học": {
        post: "Người mới nên bắt đầu từ đâu vậy mn? Tui mất gốc tiếng Anh, giờ học Trung có khó không?",
        comments: [
          "tui mất gốc tiếng Anh, giờ học Trung có khó không?",
          "học tiếng Trung có vui không các bạn?",
          "mk đang học HSK 2, có nên học thêm gì không?",
          "từ vựng nhiều quá, nhớ không nổi 😅",
          "ai có tip học pinyin hiệu quả không?",
        ],
      },
      "tự học": {
        post: "Tự học tiếng Trung ở nhà có hiệu quả không mn? Em muốn tự học nhưng không biết bắt đầu từ đâu",
        comments: [
          "tui cũng đang tự học, khó quá",
          "mk mới tự học, có tip gì không?",
          "ai có lộ trình tự học chia sẻ mk với",
          "tự học thì nên bắt đầu từ đâu?",
          "mk muốn tự học nhưng không biết có hiệu quả không",
        ],
      },
    };

    const template = templates[input.category] || templates["hỏi kinh nghiệm học"];

    return {
      title: `Seeding ${input.category} - ${new Date().toLocaleDateString("vi-VN")}`,
      category: input.category,
      post: template.post,
      comments: template.comments,
      redirect: {
        group_name: input.targetGroup?.name || "",
        group_url: input.targetGroup?.url || "",
        content: input.targetGroup 
          ? `Tui cũng từng tìm lớp nên thấy quan trọng là chọn chỗ phù hợp á. B vào nhóm này hỏi thêm nè:\n${input.targetGroup.url}`
          : "NO_GROUP_FOUND",
      },
    };
  },

  /**
   * Generate redirect comment từ nội dung bất kỳ (dùng cho Redirect Tool)
   */
  async generateRedirectOnly(input: {
    content: string;
    targetGroup?: SeedingGroup;
  }): Promise<{
    detectedCategory: SeedingCategory;
    redirectComment: string;
    group_name: string;
    group_url: string;
  }> {
    // Detect category từ nội dung
    const content = input.content.toLowerCase();
    let category: SeedingCategory = "hỏi kinh nghiệm học";
    
    if (content.includes("trung tâm") || content.includes("khóa học")) {
      category = "tìm trung tâm";
    } else if (content.includes("gia sư") || content.includes("dạy kèm")) {
      category = "tìm gia sư";
    } else if (content.includes("lớp") && !content.includes("online")) {
      category = "tìm lớp";
    } else if (content.includes("online") || content.includes("1:1")) {
      category = "học online";
    } else if (content.includes("hs") || content.includes("thi") || content.includes("luyện đề")) {
      category = "hỏi HSK";
    } else if (content.includes("tài liệu") || content.includes("sách") || content.includes("giáo trình")) {
      category = "hỏi tài liệu";
    } else if (content.includes("app") || content.includes("web") || content.includes("ứng dụng")) {
      category = "hỏi app/web";
    } else if (content.includes("tự học") || content.includes("tự mình")) {
      category = "tự học";
    }

    const categoryDesc = CATEGORY_DESCRIPTIONS[category];
    const targetGroupContext = input.targetGroup
      ? `\n\nGROUP ĐỂ REDIRECT:\n- Name: ${input.targetGroup.name}\n- URL: ${input.targetGroup.url}\n- Category: ${input.targetGroup.category}`
      : "\n\n(Không có group trong database)";

    const prompt = `Bạn là AI viết comment kéo member cho Facebook group tiếng Trung.

NHIỆM VỤ:
Dựa vào nội dung bên dưới, viết một comment redirect tự nhiên để kéo member vào nhóm phù hợp.

NỘI DUNG CẦN PHÂN TÍCH:
"""
${input.content}
"""

PHÂN TÍCH:
- Category của bài: ${categoryDesc}
- Người viết đang ở giai đoạn: (suy luận từ nội dung)
- Nên đưa vào group nào: ${input.targetGroup?.name || "(chọn group phù hợp)"}

${targetGroupContext}

YÊU CẦU:
1. Viết comment TỰ NHIÊN như người thật (dùng mn, b, tui, mk, ạ...)
2. Cấu trúc: [chia sẻ kinh nghiệm] + [gợi ý vào nhóm] + [link nhóm]
3. Comment phải có LINK NHÓM (bắt buộc)
4. KHÔNG quảng cáo, KHÔNG spam
5. Chiều dài: 1-3 câu, tự nhiên

VÍ DỤ TỐT:
"Tui cũng từng tìm lớp nên thấy quan trọng là chọn gv phù hợp á. B vào nhóm này hỏi thêm nè: {group_url}"

TRẢ VỀ JSON:
{
  "detected_category": "...",
  "redirect_comment": "...",
  "group_name": "...",
  "group_url": "..."
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Không parse được JSON");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        detectedCategory: parsed.detected_category || category,
        redirectComment: parsed.redirect_comment || "",
        group_name: parsed.group_name || input.targetGroup?.name || "",
        group_url: parsed.group_url || input.targetGroup?.url || "",
      };
    } catch (error) {
      console.error("Gemini redirect error:", error);
      
      // Fallback
      return {
        detectedCategory: category,
        redirectComment: input.targetGroup
          ? `Tui cũng từng tìm lớp nên thấy quan trọng là chọn chỗ phù hợp á. B vào nhóm này hỏi thêm nè:\n${input.targetGroup.url}`
          : "NO_GROUP_FOUND",
        group_name: input.targetGroup?.name || "",
        group_url: input.targetGroup?.url || "",
      };
    }
  },
};
