const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      // öffentliche Routen
      {
        path: 'login',
        name: 'login',
        component: () => import('pages/LoginPage.vue'),
      },
      {
        path: 'register',
        name: 'register',
        component: () => import('pages/RegisterPage.vue'),
      },

      // geschützte Routen
      {
        path: '',
        name: 'documents',
        meta: { requiresAuth: true },
        component: () => import('pages/DocumentListPage.vue'),
      },
      {
        path: 'documents/:id',
        name: 'document-detail',
        meta: { requiresAuth: true },
        props: true,
        component: () => import('pages/DocumentDetailPage.vue'),
      },
    ],
  },

  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
