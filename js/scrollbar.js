/**
 * 仿安卓沉浸式滚动条控制脚本
 * 用法：在 HTML 中引入此文件即可
 * <script src="scrollbar.js"></script>
 */

(function() {
  'use strict';

  // ========== 配置项（可按需修改） ==========
  const CONFIG = {
    delay: 1500,           // 停止滚动后多久隐藏（毫秒）
    fadeDuration: 400,     // 渐隐渐显时长（毫秒，需与 CSS 中的 transition 保持一致）
    debug: false,          // 是否开启控制台调试信息
    hideOnMouseLeave: true // 鼠标离开窗口时是否自动隐藏
  };

  // ========== 状态变量 ==========
  let timer = null;
  let isVisible = false;
  let isInitialized = false;

  // ========== DOM 引用 ==========
  const root = document.documentElement;
  const body = document.body;

  // ========== 核心函数 ==========
  
  /**
   * 显示滚动条
   */
  function showScrollbar() {
    if (!isVisible) {
      root.classList.add('scrollbar-visible');
      body.classList.add('scrollbar-visible');
      isVisible = true;
      
      if (CONFIG.debug) {
        console.log('[Scrollbar] 显示');
      }
    }
  }

  /**
   * 隐藏滚动条
   */
  function hideScrollbar() {
    if (isVisible) {
      root.classList.remove('scrollbar-visible');
      body.classList.remove('scrollbar-visible');
      isVisible = false;
      
      if (CONFIG.debug) {
        console.log('[Scrollbar] 隐藏');
      }
    }
  }

  /**
   * 重置隐藏定时器
   */
  function resetHideTimer() {
    // 清除旧定时器
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    
    // 显示滚动条
    showScrollbar();
    
    // 设置新定时器
    timer = setTimeout(() => {
      hideScrollbar();
      timer = null;
    }, CONFIG.delay);
  }

  /**
   * 滚动事件处理
   */
  function handleScroll() {
    resetHideTimer();
  }

  /**
   * 鼠标离开窗口时隐藏（可选）
   */
  function handleMouseLeave() {
    if (CONFIG.hideOnMouseLeave) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      hideScrollbar();
      
      if (CONFIG.debug) {
        console.log('[Scrollbar] 鼠标离开，立即隐藏');
      }
    }
  }

  /**
   * 页面可见性变化时处理（切换标签页时隐藏）
   */
  function handleVisibilityChange() {
    if (document.hidden) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      hideScrollbar();
      
      if (CONFIG.debug) {
        console.log('[Scrollbar] 页面隐藏，立即隐藏');
      }
    }
  }

  /**
   * 初始化
   */
  function init() {
    if (isInitialized) return;
    
    // 监听滚动事件
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // 监听鼠标离开窗口
    document.addEventListener('mouseleave', handleMouseLeave);
    
    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 页面加载完成后，检查初始滚动位置
    if (document.readyState === 'complete') {
      handleInitialState();
    } else {
      window.addEventListener('load', handleInitialState);
    }
    
    isInitialized = true;
    
    if (CONFIG.debug) {
      console.log('[Scrollbar] 初始化完成，延迟:', CONFIG.delay, 'ms');
    }
  }

  /**
   * 处理初始状态
   */
  function handleInitialState() {
    // 如果页面有滚动位置，显示一会儿再隐藏
    if (window.scrollY > 0 || document.documentElement.scrollTop > 0) {
      showScrollbar();
      
      // 延迟隐藏
      setTimeout(() => {
        hideScrollbar();
      }, CONFIG.delay);
    } else {
      hideScrollbar();
    }
  }

  /**
   * 销毁（清理资源）
   */
  function destroy() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    
    window.removeEventListener('scroll', handleScroll);
    document.removeEventListener('mouseleave', handleMouseLeave);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    
    hideScrollbar();
    isInitialized = false;
    
    if (CONFIG.debug) {
      console.log('[Scrollbar] 已销毁');
    }
  }

  /**
   * 更新配置（动态修改延迟时间等）
   */
  function updateConfig(newConfig) {
    Object.assign(CONFIG, newConfig);
    
    if (CONFIG.debug) {
      console.log('[Scrollbar] 配置已更新:', CONFIG);
    }
  }

  // ========== 导出 API（供外部调用） ==========
  // 在全局暴露控制接口
  window.ScrollbarControl = {
    show: showScrollbar,
    hide: hideScrollbar,
    reset: resetHideTimer,
    destroy: destroy,
    updateConfig: updateConfig,
    getConfig: () => ({ ...CONFIG }),
    getState: () => ({ isVisible, isInitialized })
  };

  // ========== 自动初始化 ==========
  // 等待 DOM 就绪后自动启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();