import { AuthorCardProps } from "../components/AuthorCard";
import Layout from "../components/Layout";
import PostCard from "../components/PostCard";
import { Article } from "../types/article";
import { LayoutProps } from "../utils/getLayoutProps";
import { getIndexPageProps } from "../utils/getPageProps";
import { revalidate } from "../utils/loadConfig";
import Waline from "../components/WaLine";
import Head from "next/head";
import { getArticlesKeyWord } from "../utils/keywords";
import { getArticlePath } from "../utils/getArticlePath";
import { encodeQuerystring } from "../utils/encode";
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Footer from "../components/Footer";
import AuthorCard from "../components/AuthorCard";
import { getArticlesByOption } from "../api/getArticles";
import { useWindowSize } from "react-use";

export interface IndexPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  currPage: number;
  articles: Article[];
  tags: string[];
}

const Home = (props: IndexPageProps) => {
  const [articles, setArticles] = useState<Article[]>(props.articles);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const observerTarget = useRef(null);
  const { width } = useWindowSize();
  const [mounted, setMounted] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const tagBarRef = useRef<HTMLDivElement | null>(null);
  const bottomNavRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const isDraggingRef = useRef(false);
  const categoryHeaderRef = useRef<HTMLDivElement | null>(null);
  const authorWrapRef = useRef<HTMLDivElement | null>(null);
  const footerWrapRef = useRef<HTMLDivElement | null>(null);
  const [catListMax, setCatListMax] = useState<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const vh = typeof window !== "undefined" ? window.innerHeight : 0;
    const topOffset = 72;
    const headerH = categoryHeaderRef.current?.offsetHeight || 40;
    const authorH = authorWrapRef.current?.offsetHeight || (width >= 1024 ? 220 : 0);
    const footerH = footerWrapRef.current?.offsetHeight || (width >= 1024 ? 120 : 0);
    const childrenCount = width >= 1024 ? 3 : 1;
    const totalGaps = (childrenCount - 1) * 12;
    const available = vh - topOffset - authorH - footerH - totalGaps - headerH;
    setCatListMax(available > 0 ? `${available}px` : "0px");
  }, [mounted, width]);

  useEffect(() => {
    if (!router.isReady) return;
    const { tag, category } = router.query as { tag?: string; category?: string };
    reloadWithFilter({ tag: tag || null, category: category || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.tag, router.query.category]);

  useEffect(() => {
    const enhance = (el: HTMLElement | null) => {
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          el.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      };
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;
      const threshold = 4;
      const onPointerDown = (e: PointerEvent) => {
        isDown = true;
        startX = e.clientX;
        scrollLeft = el.scrollLeft;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!isDown) return;
        const dx = e.clientX - startX;
        el.scrollLeft = scrollLeft - dx;
        if (Math.abs(dx) > threshold) {
          isDraggingRef.current = true;
        }
      };
      const onPointerUp = () => {
        isDown = false;
        setTimeout(() => (isDraggingRef.current = false), 0);
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      el.addEventListener("pointerdown", onPointerDown);
      el.addEventListener("pointermove", onPointerMove);
      el.addEventListener("pointerup", onPointerUp);
      return () => {
        el.removeEventListener("wheel", onWheel);
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("pointermove", onPointerMove);
        el.removeEventListener("pointerup", onPointerUp);
      };
    };
    const cleanupTag = enhance(tagBarRef.current);
    const cleanupBottom = enhance(bottomNavRef.current);
    return () => {
      cleanupTag?.();
      cleanupBottom?.();
    };
  }, []);

  // Masonry layout columns
  const columns = useMemo(() => {
    let numCols = 1;
    // Only calculate columns on client side to avoid hydration mismatch
    if (mounted) {
      if (width >= 1280) numCols = 3;
      else if (width >= 768) numCols = 2;
      else if (width >= 575) numCols = 2;
      else numCols = 1;
    } else {
      // Default for SSR/Initial render (mobile first or desktop default?)
      // To avoid layout shift, we might want to default to 1 or match CSS media queries
      // But since we use JS for layout, hydration mismatch is inevitable if we don't handle it.
      // We can default to 1 and let it adjust after mount.
      numCols = 1;
    }

    const cols: Article[][] = Array.from({ length: numCols }, () => []);
    articles.forEach((article, index) => {
      cols[index % numCols].push(article);
    });
    return cols;
  }, [articles, width, mounted]);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const res = await getArticlesByOption({
        page: nextPage,
        pageSize: 10,
        tags: selectedTag || undefined,
        category: selectedCategory || undefined,
      });

      if (res.articles.length === 0) {
        setHasMore(false);
      } else {
        setArticles((prev) => {
          const newArticles = res.articles.filter(
            (newArticle) => !prev.some((article) => article.id === newArticle.id)
          );
          return [...prev, ...newArticles];
        });
        setPage(nextPage);
      }
    } catch (error) {
      console.error("Failed to load more articles", error);
    } finally {
      setLoading(false);
    }
  };

  const reloadWithFilter = async (opts: { tag?: string | null; category?: string | null }) => {
    setSelectedTag(opts.tag || null);
    setSelectedCategory(opts.category || null);
    setPage(1);
    setHasMore(true);
    setLoading(true);
    try {
      const res = await getArticlesByOption({
        page: 1,
        pageSize: 10,
        tags: (opts.tag || null) || undefined,
        category: (opts.category || null) || undefined,
      });
      setArticles(res.articles || []);
      if (!res.articles || res.articles.length < 10) {
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
    const q: Record<string, string> = {};
    if (opts.tag) q.tag = opts.tag as string;
    if (opts.category) q.category = opts.category as string;
    router.replace({ pathname: "/", query: q }, undefined, { shallow: true });
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [observerTarget, loading, hasMore]);

  return (
    <Layout
      option={props.layoutProps}
      title={props.layoutProps.siteName}
      wide
      sideBar={
        <div className="sticky top-[72px] space-y-3 max-h-[calc(100vh-72px-16px)] no-scrollbar max-w-full">
          <div className="bg-white dark:bg-dark card-shadow dark:card-shadow-dark rounded">
            <div ref={categoryHeaderRef} className="px-4 pt-3 pb-2 text-sm font-medium text-gray-800 dark:text-dark text-center">分类</div>
            <ul className="no-scrollbar overflow-y-auto" style={{ maxHeight: catListMax }}>
              {["全部", ...props.layoutProps.categories].map((cat) => (
                <li
                  key={cat}
                  className={`px-4 py-2 text-sm ${selectedCategory===cat||(!selectedCategory&&cat==="全部")?"bg-gray-100 dark:bg-dark-2":""} text-gray-700 dark:text-dark hover:bg-gray-100 dark:hover:bg-dark-2 cursor-pointer text-center`}
                  onClick={(e)=>{e.preventDefault(); reloadWithFilter({category: cat==="全部"? null : cat, tag: selectedTag});}}
                >
                  {cat}
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden lg:block" ref={authorWrapRef}>
            <AuthorCard option={props.authorCardProps} />
          </div>
          <div className="hidden lg:block" ref={footerWrapRef}>
            <Footer
              ipcHref={props.layoutProps.ipcHref}
              ipcNumber={props.layoutProps.ipcNumber}
              since={props.layoutProps.since}
              version={props.layoutProps.version}
              gaBeianLogoUrl={props.layoutProps.gaBeianLogoUrl}
              gaBeianNumber={props.layoutProps.gaBeianNumber}
              gaBeianUrl={props.layoutProps.gaBeianUrl}
            />
          </div>
        </div>
      }
      sidePosition="left"
      hideFooter={true}
      navAutoHide={false}
    >
      <Head>
        <meta
          name="keywords"
          content={getArticlesKeyWord(props.articles).join(",")}
        ></meta>
      </Head>

      <div className="space-y-4">
        <div ref={tagBarRef} className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark px-3 lg:px-4 overflow-x-auto no-scrollbar h-12 flex items-center">
          <div className="flex items-center gap-2 whitespace-nowrap mx-auto">
            {props.tags.map((tag) => (
              <a
                key={tag}
                href="#"
                onClick={(e)=>{
                  if (isDraggingRef.current) { e.preventDefault(); return; }
                  e.preventDefault();
                  reloadWithFilter({tag: selectedTag===tag? null : tag, category:selectedCategory});
                }}
                className={`inline-block px-3 py-1 mx-1 rounded-full text-sm ${selectedTag===tag?"bg-gray-800 text-white dark:bg-dark-2":"bg-gray-100 text-gray-700 dark:bg-dark-2 dark:text-dark"}`}
              >
                {tag}
              </a>
            ))}
          </div>
        </div>

        {articles.length === 0 && !loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto" aria-hidden="true">
                <circle cx="60" cy="60" r="56" fill="#F3F4F6" className="dark:hidden" />
                <circle cx="60" cy="60" r="56" fill="#1F2937" className="hidden dark:block" />
                <g opacity="0.6">
                  <rect x="30" y="40" width="60" height="40" rx="8" fill="#9CA3AF" />
                  <rect x="38" y="48" width="28" height="8" rx="4" fill="#D1D5DB" />
                  <rect x="38" y="62" width="44" height="8" rx="4" fill="#D1D5DB" />
                </g>
              </svg>
              <div className="mt-4 text-sm text-gray-500 dark:text-dark">暂无文章</div>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 items-start">
            {columns.map((col, colIndex) => (
              <div key={colIndex} className="flex-1 flex flex-col gap-4 min-w-0">
                {col.map((article) => (
                  <div key={article.id} className="break-inside-avoid">
                    <PostCard
                      showEditButton={props.layoutProps.showEditButton === "true"}
                      setContent={() => {}}
                      showExpirationReminder={
                        props.layoutProps.showExpirationReminder == "true"
                      }
                      openArticleLinksInNewWindow={
                        props.layoutProps.openArticleLinksInNewWindow == "true"
                      }
                      customCopyRight={null}
                      private={article.private}
                      top={article.top || 0}
                      id={getArticlePath(article)}
                      title={article.title}
                      cover={article.cover}
                      updatedAt={new Date(article.updatedAt)}
                      createdAt={new Date(article.createdAt)}
                      catelog={article.category}
                      content={article.content || ""}
                      type={"overview"}
                      enableComment={props.layoutProps.enableComment}
                      copyrightAggreement={props.layoutProps.copyrightAggreement}
                    ></PostCard>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        </div>

      <div ref={observerTarget} className="h-10 flex justify-center items-center mt-4">
        {loading && <div className="text-gray-500">加载中...</div>}
        {!hasMore && articles.length > 0 && <div className="text-gray-500">没有更多了</div>}
      </div>

      <Waline enable={props.layoutProps.enableComment} visible={false} />

      <div ref={bottomNavRef} className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-dark border-t border-gray-200 dark:border-nav-dark h-14 flex items-center z-50 overflow-x-auto no-scrollbar">
        <div className="flex w-full">
          {["全部", ...props.layoutProps.categories].map((cat)=> (
            <button
              key={cat}
              className={`flex-none w-1/4 h-14 text-sm ${selectedCategory===cat||(!selectedCategory&&cat==="全部")?"text-gray-900 font-medium":"text-gray-700"} dark:text-dark`}
              onClick={(e)=>{ if (isDraggingRef.current) { e.preventDefault(); return; } reloadWithFilter({category: cat==="全部"? null : cat, tag: selectedTag}); }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </Layout>
  );
};

export default Home;
export async function getStaticProps(): Promise<{
  props: IndexPageProps;
  revalidate?: number;
}> {
  return {
    props: await getIndexPageProps(),
    ...revalidate,
  };
}
