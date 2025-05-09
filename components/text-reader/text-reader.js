Component({
  properties: {
    chapter: {
      type: Object,
      value: { title: '', content: '', richText: '' },
      observer: function(newVal) {
        // Ensure richText is properly formatted for the rich-text component
        if (newVal && newVal.richText) {
          // The rich-text component expects a string containing valid HTML
          // No additional processing needed as the API already returns HTML
        }
      }
    },
    fontSize: {
      type: Number,
      value: 32
    },
    theme: {
      type: String,
      value: 'light'
    }
  },

  methods: {
    onScroll() {
      this.triggerEvent('scroll');
    }
  }
}); 