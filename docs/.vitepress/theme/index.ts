import DefaultTheme from 'vitepress/theme';
import PdfPlayground from '../components/PdfPlayground.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PdfPlayground', PdfPlayground);
  },
};
