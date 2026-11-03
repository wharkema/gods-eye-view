<script setup>
import { onMounted, ref } from 'vue';
import { t } from '../i18n/index.js';
import { SELF_HOSTING, fetchSession } from './logoutButton.js';

// Self-hosting fork: a logout button beside the globe actions, shown only
// when the server has the login on. The form posts to the relative
// `uitloggen`, so it works under a sub-path too.
const session = ref(null);
onMounted(async () => {
  if (SELF_HOSTING) session.value = await fetchSession();
});
</script>

<template>
  <form v-if="session" class="logout-form" method="post" action="uitloggen">
    <button id="logout-btn" type="submit" :aria-label="t('Log out')" :title="session.gebruiker ? t('Log out ({user})', { user: session.gebruiker }) : t('Log out')">
      <span class="material-symbols-outlined" aria-hidden="true">logout</span>
    </button>
  </form>
</template>
