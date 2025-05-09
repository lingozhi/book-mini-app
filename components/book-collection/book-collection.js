Component({
  properties: {
    collection: {
      type: Array,
      value: []
    }
  },

  methods: {
    openBook(e) {
      const { id } = e.currentTarget.dataset;
      this.triggerEvent('bookSelect', { id });
    }
  }
}); 