/**
 * Seeding Database Service - Firebase Firestore
 * 
 * Layer giữa application và Firestore
 */

import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  deleteDoc, query, where, orderBy, Timestamp, serverTimestamp 
} from "firebase/firestore";
import { db } from "./firebase";

import type {
  SeedingPost,
  SeedingComment,
  SeedingGroup,
  SeedingCategory,
  GroupCategory,
  PostStatus,
  CommentType,
  GroupStatus,
  DailyStats,
} from "@/types/seeding";

// ── Collection References ────────────────────────────────────────────────────────

const POSTS_COL = "seeding_posts";
const COMMENTS_COL = "seeding_comments";
const GROUPS_COL = "seeding_groups";
const DAILY_STATS_COL = "seeding_daily_stats";

// ── ID Generator ──────────────────────────────────────────────────────────────

function getDateString(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

// ── Converters ────────────────────────────────────────────────────────────────

function postToSeedingPost(data: any, comments: SeedingComment[] = []): SeedingPost {
  return {
    id: data.id,
    title: data.title || "",
    content: data.content,
    category: data.category,
    groupType: data.group_type,
    targetGroup: data.target_group,
    status: data.status || "ready",
    comments,
    goal: data.goal || "",
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
    usedAt: data.usedAt instanceof Timestamp ? data.usedAt.toDate() : data.usedAt ? new Date(data.usedAt) : undefined,
  };
}

function commentToSeedingComment(data: any): SeedingComment {
  return {
    id: data.id,
    postId: data.post_id,
    content: data.content,
    tone: data.tone || "mixed",
    type: data.type,
    used: data.used || false,
    usedAt: data.usedAt ? (data.usedAt instanceof Timestamp ? data.usedAt.toDate() : new Date(data.usedAt)) : undefined,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
  };
}

function groupToSeedingGroup(data: any): SeedingGroup {
  return {
    id: data.id,
    name: data.name,
    url: data.url,
    category: data.category,
    status: data.status,
    memberCount: data.memberCount,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
    lastUsedAt: data.lastUsedAt ? (data.lastUsedAt instanceof Timestamp ? data.lastUsedAt.toDate() : new Date(data.lastUsedAt)) : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE SERVICE - Firebase Firestore
// ═══════════════════════════════════════════════════════════════════════════════

export const seedingDb = {
  // ═══════════════════════════════════════════════════════════════════════════════
  // POSTS
  // ═══════════════════════════════════════════════════════════════════════════════

  async createPost(data: {
    title: string;
    content: string;
    category: SeedingCategory;
    group_type?: GroupCategory;
    target_group_id?: string;
    target_group?: string;
    goal?: string;
  }): Promise<SeedingPost> {
    const postRef = doc(collection(db, POSTS_COL));
    
    const postData = {
      id: postRef.id,
      title: data.title,
      content: data.content,
      category: data.category,
      group_type: data.group_type || null,
      target_group_id: data.target_group_id || null,
      target_group: data.target_group || null,
      status: "ready",
      goal: data.goal || "",
      createdAt: serverTimestamp(),
      usedAt: null,
      scheduledAt: null,
    };
    
    await setDoc(postRef, postData);
    
    // Update daily stats
    this.updateDailyStats(data.category);
    
    return {
      id: postRef.id,
      title: data.title,
      content: data.content,
      category: data.category,
      groupType: data.group_type,
      targetGroup: data.target_group,
      status: "ready",
      comments: [],
      goal: data.goal || "",
      createdAt: new Date(),
    };
  },

  async getAllPosts(): Promise<SeedingPost[]> {
    // Simple query without deletedAt check (Firestore can't query null)
    const q = query(
      collection(db, POSTS_COL),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(q);
    const posts: SeedingPost[] = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      // Skip deleted posts (those with status = "archived")
      if (data.status === "archived") continue;
      
      const comments = await this.getCommentsByPost(docSnap.id);
      posts.push(postToSeedingPost({ ...data, id: docSnap.id }, comments));
    }
    
    return posts;
  },

  async getPost(id: string): Promise<SeedingPost | null> {
    const docRef = doc(db, POSTS_COL, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    if (data.status === "archived") return null;
    
    const comments = await this.getCommentsByPost(id);
    return postToSeedingPost({ ...data, id: docSnap.id }, comments);
  },

  async getPostsByDate(date: string): Promise<SeedingPost[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const q = query(
      collection(db, POSTS_COL),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(q);
    const posts: SeedingPost[] = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const createdAt = data.createdAt instanceof Timestamp 
        ? data.createdAt.toDate() 
        : new Date(data.createdAt);
      
      if (createdAt >= startOfDay && createdAt <= endOfDay && data.status !== "archived") {
        const comments = await this.getCommentsByPost(docSnap.id);
        posts.push(postToSeedingPost({ ...data, id: docSnap.id }, comments));
      }
    }
    
    return posts;
  },

  async getPostsByDateRange(startDate: string, endDate: string): Promise<SeedingPost[]> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const q = query(
      collection(db, POSTS_COL),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(q);
    const posts: SeedingPost[] = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const createdAt = data.createdAt instanceof Timestamp 
        ? data.createdAt.toDate() 
        : new Date(data.createdAt);
      
      if (createdAt >= start && createdAt <= end && data.status !== "archived") {
        const comments = await this.getCommentsByPost(docSnap.id);
        posts.push(postToSeedingPost({ ...data, id: docSnap.id }, comments));
      }
    }
    
    return posts;
  },

  async updatePost(id: string, updates: Partial<any>): Promise<SeedingPost | null> {
    const docRef = doc(db, POSTS_COL, id);
    await updateDoc(docRef, updates);
    return this.getPost(id);
  },

  async updatePostStatus(id: string, status: PostStatus): Promise<boolean> {
    const updates: any = { status };
    
    if (status === "used") {
      updates.usedAt = serverTimestamp();
    } else if (status === "archived") {
      // Just update status, don't actually delete
      updates.archivedAt = serverTimestamp();
    }
    
    await this.updatePost(id, updates);
    return true;
  },

  async deletePost(id: string): Promise<boolean> {
    // Soft delete by setting status to archived
    return this.updatePostStatus(id, "archived");
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // COMMENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  async createComment(data: {
    post_id: string;
    content: string;
    type: CommentType;
    tone?: string;
  }): Promise<SeedingComment> {
    const commentRef = doc(collection(db, COMMENTS_COL));
    
    const commentData = {
      id: commentRef.id,
      post_id: data.post_id,
      content: data.content,
      type: data.type,
      tone: data.tone || "mixed",
      used: false,
      usedAt: null,
      createdAt: serverTimestamp(),
    };
    
    await setDoc(commentRef, commentData);
    
    return {
      id: commentRef.id,
      postId: data.post_id,
      content: data.content,
      tone: data.tone || "mixed",
      type: data.type,
      used: false,
      createdAt: new Date(),
    };
  },

  async createComments(data: {
    post_id: string;
    contents: string[];
    type: CommentType;
    tone?: string;
  }): Promise<SeedingComment[]> {
    const comments: SeedingComment[] = [];
    
    for (const content of data.contents) {
      const comment = await this.createComment({
        post_id: data.post_id,
        content,
        type: data.type,
        tone: data.tone,
      });
      comments.push(comment);
    }
    
    return comments;
  },

  async getAllComments(): Promise<SeedingComment[]> {
    const snapshot = await getDocs(collection(db, COMMENTS_COL));
    return snapshot.docs.map(doc => commentToSeedingComment({ ...doc.data(), id: doc.id }));
  },

  async getCommentsByPost(postId: string): Promise<SeedingComment[]> {
    const q = query(
      collection(db, COMMENTS_COL),
      where("post_id", "==", postId)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => commentToSeedingComment({ ...doc.data(), id: doc.id }));
  },

  async markCommentUsed(id: string): Promise<boolean> {
    const docRef = doc(db, COMMENTS_COL, id);
    await updateDoc(docRef, {
      used: true,
      usedAt: serverTimestamp(),
    });
    return true;
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // GROUPS
  // ═══════════════════════════════════════════════════════════════════════════════

  async createGroup(data: {
    name: string;
    url: string;
    category: GroupCategory;
    memberCount?: number;
    status?: GroupStatus;
  }): Promise<SeedingGroup> {
    const groupRef = doc(collection(db, GROUPS_COL));
    
    const groupData = {
      id: groupRef.id,
      name: data.name,
      url: data.url,
      category: data.category,
      memberCount: data.memberCount || 0,
      status: data.status || "active",
      createdAt: serverTimestamp(),
      lastUsedAt: null,
    };
    
    await setDoc(groupRef, groupData);
    
    return {
      id: groupRef.id,
      name: data.name,
      url: data.url,
      category: data.category,
      status: data.status || "active",
      memberCount: data.memberCount,
      createdAt: new Date(),
    };
  },

  async getAllGroups(): Promise<SeedingGroup[]> {
    const snapshot = await getDocs(collection(db, GROUPS_COL));
    return snapshot.docs
      .map(doc => groupToSeedingGroup({ ...doc.data(), id: doc.id }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async getActiveGroups(): Promise<SeedingGroup[]> {
    const allGroups = await this.getAllGroups();
    return allGroups.filter(g => g.status === "active");
  },

  async getGroupsByCategory(category: GroupCategory): Promise<SeedingGroup[]> {
    const allGroups = await this.getAllGroups();
    return allGroups.filter(g => g.category === category && g.status === "active");
  },

  async getGroup(id: string): Promise<SeedingGroup | null> {
    const docRef = doc(db, GROUPS_COL, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    return groupToSeedingGroup({ ...docSnap.data(), id: docSnap.id });
  },

  async updateGroup(id: string, updates: Partial<SeedingGroup>): Promise<SeedingGroup | null> {
    const docRef = doc(db, GROUPS_COL, id);
    
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.url !== undefined) updateData.url = updates.url;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.memberCount !== undefined) updateData.memberCount = updates.memberCount;
    
    await updateDoc(docRef, updateData);
    return this.getGroup(id);
  },

  async deleteGroup(id: string): Promise<boolean> {
    const docRef = doc(db, GROUPS_COL, id);
    await deleteDoc(docRef);
    return true;
  },

  async markGroupUsed(id: string): Promise<boolean> {
    const docRef = doc(db, GROUPS_COL, id);
    await updateDoc(docRef, {
      lastUsedAt: serverTimestamp(),
    });
    return true;
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DAILY STATS
  // ═══════════════════════════════════════════════════════════════════════════════

  async updateDailyStats(category: SeedingCategory): Promise<void> {
    const today = getDateString();
    const docRef = doc(db, DAILY_STATS_COL, today);
    
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      await updateDoc(docRef, {
        posts_count: (data.posts_count || 0) + 1,
      });
    } else {
      await setDoc(docRef, {
        id: today,
        date: today,
        posts_count: 1,
        comments_count: 0,
        redirect_count: 0,
        categories_used: [category],
        groups_used: [],
        createdAt: serverTimestamp(),
      });
    }
  },

  async getAllDailyStats(): Promise<DailyStats[]> {
    const snapshot = await getDocs(
      query(collection(db, DAILY_STATS_COL), orderBy("date", "desc"))
    );
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        date: data.date,
        posts_count: data.posts_count || 0,
        comments_count: data.comments_count || 0,
        redirect_count: data.redirect_count || 0,
        categories_used: data.categories_used || [],
        groups_used: data.groups_used || [],
      };
    });
  },

  async getDailyStatsByRange(startDate: string, endDate: string): Promise<DailyStats[]> {
    const q = query(
      collection(db, DAILY_STATS_COL),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "desc")
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        date: data.date,
        posts_count: data.posts_count || 0,
        comments_count: data.comments_count || 0,
        redirect_count: data.redirect_count || 0,
        categories_used: data.categories_used || [],
        groups_used: data.groups_used || [],
      };
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // AGGREGATIONS & ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  async getOverallStats(): Promise<{
    totalPosts: number;
    totalComments: number;
    readyPosts: number;
    usedPosts: number;
    archivedPosts: number;
    activeGroups: number;
    usedComments: number;
    totalRedirects: number;
  }> {
    const [posts, comments, groups] = await Promise.all([
      this.getAllPosts(),
      this.getAllComments(),
      this.getActiveGroups(),
    ]);
    
    return {
      totalPosts: posts.length,
      totalComments: comments.length,
      readyPosts: posts.filter(p => p.status === "ready").length,
      usedPosts: posts.filter(p => p.status === "used").length,
      archivedPosts: posts.filter(p => p.status === "archived").length,
      activeGroups: groups.length,
      usedComments: comments.filter(c => c.used).length,
      totalRedirects: comments.filter(c => c.type === "redirect").length,
    };
  },

  async getStatsByCategory(): Promise<Record<SeedingCategory, { count: number; comments: number }>> {
    const posts = await this.getAllPosts();
    const comments = await this.getAllComments();
    
    const categories: SeedingCategory[] = [
      "tìm khóa học", "tìm trung tâm", "tìm lớp", "tìm gia sư",
      "học online", "hỏi tài liệu", "hỏi app/web", "hỏi HSK",
      "hỏi kinh nghiệm học", "tự học",
    ];
    
    const result: Record<string, { count: number; comments: number }> = {};
    
    for (const cat of categories) {
      const catPosts = posts.filter(p => p.category === cat);
      const catPostIds = catPosts.map(p => p.id);
      const catComments = comments.filter(c => catPostIds.includes(c.postId));
      
      result[cat] = {
        count: catPosts.length,
        comments: catComments.length,
      };
    }
    
    return result as Record<SeedingCategory, { count: number; comments: number }>;
  },

  async getWeeklyStats(): Promise<{ date: string; posts: number; comments: number; used: number }[]> {
    const result: { date: string; posts: number; comments: number; used: number }[] = [];
    const posts = await this.getAllPosts();
    const comments = await this.getAllComments();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = getDateString(date);
      
      const dayPosts = posts.filter(p => 
        getDateString(p.createdAt) === dateStr
      );
      const dayPostIds = dayPosts.map(p => p.id);
      const dayComments = comments.filter(c => dayPostIds.includes(c.postId));
      
      result.push({
        date: dateStr,
        posts: dayPosts.length,
        comments: dayComments.length,
        used: dayPosts.filter(p => p.status === "used").length,
      });
    }
    
    return result;
  },

  async getRecentHistory(limit: number = 20): Promise<{
    post: SeedingPost;
    comments: SeedingComment[];
    group: SeedingGroup | null;
  }[]> {
    const posts = await this.getAllPosts();
    const topPosts = posts.slice(0, limit);
    
    const results = [];
    for (const post of topPosts) {
      const comments = await this.getCommentsByPost(post.id);
      let group = null;
      
      if (post.targetGroup) {
        const groups = await this.getAllGroups();
        group = groups.find(g => g.name === post.targetGroup) || null;
      }
      
      results.push({ post, comments, group });
    }
    
    return results;
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SAMPLE DATA
  // ═══════════════════════════════════════════════════════════════════════════════

  async initSampleData(): Promise<void> {
    const groups = await this.getAllGroups();
    
    if (groups.length === 0) {
      console.log("Initializing sample groups in Firebase...");
      await this.createGroup({
        name: "Review Khóa Học Tiếng Trung",
        url: "https://facebook.com/groups/reviewkhoahoc",
        category: "review",
        memberCount: 12500,
      });
      await this.createGroup({
        name: "Học Tiếng Trung Online 1:1",
        url: "https://facebook.com/groups/onlinett",
        category: "online",
        memberCount: 8500,
      });
      await this.createGroup({
        name: "HSK - Lộ Trình Thi",
        url: "https://facebook.com/groups/hskthuctap",
        category: "hsk",
        memberCount: 6200,
      });
      await this.createGroup({
        name: "Tài Liệu & App Học Trung",
        url: "https://facebook.com/groups/tailieutrang",
        category: "tailieu",
        memberCount: 4800,
      });
      console.log("Sample groups created successfully!");
    }
  },
};
