/**
 * Seeding Service - AI Agent Logic
 * 
 * Dùng AI (Gemini) để generate content động
 * Fallback về template nếu AI fail
 */

import { seedingDb } from "./seedingDb";
import { aiSeedingService } from "./aiSeedingService";
import type {
  SeedingPost,
  SeedingGroup,
  SeedingCategory,
  GroupCategory,
  PostStatus,
  GeneratePostInput,
  RedirectEngineResult,
  SeedPostResult,
  BaitCommentsResult,
} from "@/types/seeding";

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function detectCategory(input: string): SeedingCategory {
  const content = input.toLowerCase();
  
  if (content.includes("trung tâm")) return "tìm trung tâm";
  if (content.includes("gia sư") || content.includes("dạy kèm")) return "tìm gia sư";
  if (content.includes("lớp")) return "tìm lớp";
  if (content.includes("khóa học")) return "tìm khóa học";
  if (content.includes("online") || content.includes("1:1")) return "học online";
  if (content.includes("hs") || content.includes("thi")) return "hỏi HSK";
  if (content.includes("tài liệu") || content.includes("sách")) return "hỏi tài liệu";
  if (content.includes("app") || content.includes("web")) return "hỏi app/web";
  if (content.includes("tự học")) return "tự học";
  
  return "hỏi kinh nghiệm học";
}

function mapCategoryToGroupCategory(postCategory: SeedingCategory): GroupCategory {
  const mapping: { postCategory: SeedingCategory[]; groupCategory: GroupCategory }[] = [
    { postCategory: ["tìm khóa học", "tìm trung tâm", "tìm lớp", "tìm gia sư"], groupCategory: "review" },
    { postCategory: ["học online"], groupCategory: "online" },
    { postCategory: ["hỏi HSK"], groupCategory: "hsk" },
    { postCategory: ["hỏi tài liệu", "hỏi app/web", "tự học"], groupCategory: "tailieu" },
    { postCategory: ["hỏi kinh nghiệm học"], groupCategory: "all" },
  ];
  
  for (const m of mapping) {
    if (m.postCategory.includes(postCategory)) {
      return m.groupCategory;
    }
  }
  return "all";
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC SERVICE API
// ═══════════════════════════════════════════════════════════════════════════════

export const seedingService = {
  // ── AI-Powered Campaign Generation ─────────────────────────────────────────
  
  async createCampaign(input: GeneratePostInput): Promise<{
    post: SeedingPost;
    seedResult: SeedPostResult;
    baitResult: BaitCommentsResult;
    redirectResult: RedirectEngineResult;
  }> {
    const category = input.groupType || detectCategory(input.sourceContent || input.topic);
    
    // Get target group
    let targetGroup: SeedingGroup | null = null;
    const groups = await seedingDb.getGroupsByCategory(mapCategoryToGroupCategory(category));
    if (groups.length > 0) {
      targetGroup = groups[0];
    } else {
      const allGroups = await seedingDb.getActiveGroups();
      if (allGroups.length > 0) {
        targetGroup = allGroups[0];
      }
    }
    
    // Get previous posts/comments for style engine (avoid duplicates)
    const previousPosts = await seedingDb.getAllPosts();
    const previousPostsText = previousPosts.slice(0, 20).map(p => p.content);
    const previousComments = previousPosts.flatMap(p => p.comments).map(c => c.content);
    
    // Generate using AI
    const aiCampaign = await aiSeedingService.generateCampaign({
      category,
      topic: input.topic || input.sourceContent,
      targetGroup,
      previousPosts: previousPostsText,
      previousComments,
    });
    
    // Save to Firebase
    const post = await seedingDb.createPost({
      title: aiCampaign.title,
      content: aiCampaign.post,
      category: aiCampaign.category,
      goal: `AI Generated - ${category}`,
      target_group_id: targetGroup?.id,
      target_group: targetGroup?.name,
    });
    
    // Save bait comments
    const savedComments = [];
    for (const content of aiCampaign.comments) {
      const comment = await seedingDb.createComment({
        post_id: post.id,
        content,
        type: "bait",
      });
      savedComments.push(comment);
    }
    
    // Save redirect comment
    if (aiCampaign.redirect.content !== "NO_GROUP_FOUND" && targetGroup) {
      await seedingDb.createComment({
        post_id: post.id,
        content: aiCampaign.redirect.content,
        type: "redirect",
      });
      await seedingDb.markGroupUsed(targetGroup.id);
    }
    
    // Reload post với comments
    const finalPost = await seedingDb.getPost(post.id);
    
    return {
      post: finalPost || post,
      seedResult: {
        title: aiCampaign.title,
        content: aiCampaign.post,
        category: aiCampaign.category,
        psychology: "AI Generated",
        postId: post.id,
      },
      baitResult: {
        postId: post.id,
        comments: aiCampaign.comments,
        commentObjects: savedComments,
      },
      redirectResult: {
        postId: post.id,
        originalPost: aiCampaign.post,
        detectedCategory: aiCampaign.category,
        mappedGroupCategory: targetGroup ? mapCategoryToGroupCategory(category) : "all",
        targetGroup,
        redirectComment: aiCampaign.redirect.content,
        success: !!targetGroup && aiCampaign.redirect.content !== "NO_GROUP_FOUND",
        errorMessage: !targetGroup ? "Chưa có group phù hợp, cần thêm group trong quản lý nhóm" : undefined,
      },
    };
  },
  
  // Generate 4 bài cho ngày dùng AI
  async generateDailyCampaigns(): Promise<SeedingPost[]> {
    const aiCampaigns = await aiSeedingService.generateDailyCampaigns(4);
    
    const results: SeedingPost[] = [];
    
    for (const aiCampaign of aiCampaigns) {
      // Get target group
      let targetGroup: SeedingGroup | null = null;
      const groups = await seedingDb.getGroupsByCategory(mapCategoryToGroupCategory(aiCampaign.category));
      if (groups.length > 0) {
        targetGroup = groups[0];
      } else {
        const allGroups = await seedingDb.getActiveGroups();
        if (allGroups.length > 0) {
          targetGroup = allGroups[0];
        }
      }
      
      // Save post
      const post = await seedingDb.createPost({
        title: aiCampaign.title,
        content: aiCampaign.post,
        category: aiCampaign.category,
        goal: "AI Daily Campaign",
        target_group_id: targetGroup?.id,
        target_group: targetGroup?.name,
      });
      
      // Save comments
      for (const content of aiCampaign.comments) {
        await seedingDb.createComment({
          post_id: post.id,
          content,
          type: "bait",
        });
      }
      
      // Save redirect
      if (aiCampaign.redirect.content !== "NO_GROUP_FOUND" && targetGroup) {
        await seedingDb.createComment({
          post_id: post.id,
          content: aiCampaign.redirect.content,
          type: "redirect",
        });
        await seedingDb.markGroupUsed(targetGroup.id);
      }
      
      const finalPost = await seedingDb.getPost(post.id);
      if (finalPost) results.push(finalPost);
    }
    
    return results;
  },
  
  // ── Legacy Generate (không dùng AI) ───────────────────────────────────────
  
  generateSeedPost(category?: SeedingCategory): SeedPostResult {
    const selectedCategory = category || "hỏi kinh nghiệm học";
    const postId = crypto.randomUUID();
    
    return {
      title: `Seed Post ${selectedCategory}`,
      content: "Legacy template - use AI generation instead",
      category: selectedCategory,
      psychology: "người đang tìm kiếm thông tin",
      postId,
    };
  },
  
  generateBaitComments(category: SeedingCategory, postId: string): BaitCommentsResult {
    return {
      postId,
      comments: [],
      commentObjects: [],
    };
  },
  
  async generateRedirect(postContent: string, postCategory: SeedingCategory): Promise<RedirectEngineResult> {
    const groupCategory = mapCategoryToGroupCategory(postCategory);
    const groups = await seedingDb.getGroupsByCategory(groupCategory);
    
    let targetGroup: SeedingGroup | null = null;
    
    if (groups.length > 0) {
      targetGroup = groups[0];
    } else {
      const allGroups = await seedingDb.getActiveGroups();
      if (allGroups.length > 0) {
        targetGroup = allGroups[0];
      }
    }
    
    // Use AI to generate smart redirect comment
    if (targetGroup) {
      try {
        const aiResult = await aiSeedingService.generateRedirectOnly({
          content: postContent,
          targetGroup,
        });
        
        return {
          postId: crypto.randomUUID(),
          originalPost: postContent,
          detectedCategory: aiResult.detectedCategory,
          mappedGroupCategory: groupCategory,
          targetGroup,
          redirectComment: aiResult.redirectComment,
          success: true,
        };
      } catch (error) {
        console.error("AI redirect error, using fallback:", error);
      }
    }
    
    // Fallback template
    const redirectComment = targetGroup 
      ? `Tui cũng từng tìm lớp nên thấy quan trọng là chọn chỗ phù hợp á. B vào nhóm này hỏi thêm nè:\n${targetGroup.url}`
      : "Chưa có group phù hợp, cần thêm nhóm trong quản lý nhóm";
    
    return {
      postId: crypto.randomUUID(),
      originalPost: postContent,
      detectedCategory: postCategory,
      mappedGroupCategory: groupCategory,
      targetGroup,
      redirectComment,
      success: !!targetGroup,
      errorMessage: targetGroup ? undefined : "Chưa có group phù hợp",
    };
  },

  /**
   * Generate redirect từ nội dung tùy ý (cho Redirect Tool)
   */
  async generateRedirectFromContent(content: string): Promise<RedirectEngineResult> {
    // Detect category
    const lowerContent = content.toLowerCase();
    let category: SeedingCategory = "hỏi kinh nghiệm học";
    
    if (lowerContent.includes("trung tâm") || lowerContent.includes("khóa học")) {
      category = "tìm trung tâm";
    } else if (lowerContent.includes("gia sư") || lowerContent.includes("dạy kèm")) {
      category = "tìm gia sư";
    } else if (lowerContent.includes("lớp") && !lowerContent.includes("online")) {
      category = "tìm lớp";
    } else if (lowerContent.includes("online") || lowerContent.includes("1:1")) {
      category = "học online";
    } else if (lowerContent.includes("hs") || lowerContent.includes("thi") || lowerContent.includes("luyện đề")) {
      category = "hỏi HSK";
    } else if (lowerContent.includes("tài liệu") || lowerContent.includes("sách") || lowerContent.includes("giáo trình")) {
      category = "hỏi tài liệu";
    } else if (lowerContent.includes("app") || lowerContent.includes("web") || lowerContent.includes("ứng dụng")) {
      category = "hỏi app/web";
    } else if (lowerContent.includes("tự học") || lowerContent.includes("tự mình")) {
      category = "tự học";
    }
    
    return this.generateRedirect(content, category);
  },
  
  // ── CRUD ──────────────────────────────────────────────────────────────────
  
  async getAllPosts(): Promise<SeedingPost[]> {
    return seedingDb.getAllPosts();
  },
  
  async getPost(id: string): Promise<SeedingPost | undefined> {
    return seedingDb.getPost(id);
  },
  
  async getPostsByDate(date: string): Promise<SeedingPost[]> {
    return seedingDb.getPostsByDate(date);
  },
  
  async getPostsByDateRange(startDate: string, endDate: string): Promise<SeedingPost[]> {
    return seedingDb.getPostsByDateRange(startDate, endDate);
  },
  
  async updatePostStatus(id: string, status: PostStatus): Promise<boolean> {
    return seedingDb.updatePostStatus(id, status);
  },
  
  async deletePost(id: string): Promise<boolean> {
    return seedingDb.deletePost(id);
  },
  
  async markCommentUsed(commentId: string): Promise<boolean> {
    return seedingDb.markCommentUsed(commentId);
  },
  
  // ── Groups ────────────────────────────────────────────────────────────────
  
  async getGroups(): Promise<SeedingGroup[]> {
    return seedingDb.getAllGroups();
  },
  
  async getActiveGroups(): Promise<SeedingGroup[]> {
    return seedingDb.getActiveGroups();
  },
  
  async addGroup(group: Omit<SeedingGroup, "id" | "createdAt">): Promise<SeedingGroup> {
    return seedingDb.createGroup({
      name: group.name,
      url: group.url,
      category: group.category,
      memberCount: group.memberCount,
      status: group.status,
    });
  },
  
  async updateGroup(id: string, updates: Partial<SeedingGroup>): Promise<boolean> {
    const result = await seedingDb.updateGroup(id, updates);
    return !!result;
  },
  
  async deleteGroup(id: string): Promise<boolean> {
    return seedingDb.deleteGroup(id);
  },
  
  // ── Stats ────────────────────────────────────────────────────────────────
  
  async getOverallStats() {
    return seedingDb.getOverallStats();
  },
  
  async getStatsByCategory() {
    return seedingDb.getStatsByCategory();
  },
  
  async getWeeklyStats() {
    return seedingDb.getWeeklyStats();
  },
  
  async getDailyStats(startDate?: string, endDate?: string) {
    if (startDate && endDate) {
      return seedingDb.getDailyStatsByRange(startDate, endDate);
    }
    return seedingDb.getAllDailyStats();
  },
  
  async getRecentHistory(limit?: number) {
    return seedingDb.getRecentHistory(limit);
  },
  
  async initSampleData() {
    return seedingDb.initSampleData();
  },
  
  // ── Utility ───────────────────────────────────────────────────────────────
  
  async getHistory() {
    return seedingDb.getAllDailyStats();
  },
  
  async clearAllData() {
    const posts = await this.getAllPosts();
    for (const post of posts) {
      await seedingDb.deletePost(post.id);
    }
  },
  
  exportData() {
    return Promise.resolve("{}");
  },
  
  importData(_jsonString: string) {
    return Promise.resolve(false);
  },
};
