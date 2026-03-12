export type Language = 'en' | 'th' | 'zh';

export interface Translations {
  nav: {
    home: string;
    products: string;
    howItWorks: string;
    about: string;
  };
  hero: {
    title: string;
    subtitle: string;
    orderButton: string;
  };
  whatWeBake: {
    title: string;
    croissants: {
      name: string;
      description: string;
    };
    breads: {
      name: string;
      description: string;
    };
    cakes: {
      name: string;
      description: string;
    };
    quiche: {
      name: string;
      description: string;
    };
  };
  callToAction: {
    title: string;
    subtitle: string;
    buttonText: string;
  };
  categories: {
    title: string;
    all: string;
    breads: string;
    pastries: string;
    cakes: string;
    cookies: string;
  };
  product: {
    addToCart: string;
    soldOut: string;
    preOrderOnly: string;
    cutoffPassed: string;
  };
  cart: {
    title: string;
    empty: string;
    item: string;
    items: string;
    total: string;
    checkout: string;
    continueShopping: string;
  };
  checkout: {
    title: string;
    contactInfo: string;
    name: string;
    email: string;
    phone: string;
    lineId: string;
    lineIdPlaceholder: string;
    pickupDetails: string;
    pickupLocation: string;
    selectLocation: string;
    maeRim: string;
    inTown: string;
    pickupDay: string;
    selectDay: string;
    orderSummary: string;
    paymentInfo: string;
    paymentInfoText: string;
    placeOrder: string;
    processing: string;
    required: string;
    invalidEmail: string;
    invalidPhone: string;
    authRequired: string;
    loggedInAs: string;
    pickupDayFromCatalog: string;
    logIn: string;
    signUp: string;
  };
  confirmation: {
    title: string;
    subtitle: string;
    orderNumber: string;
    thankYou: string;
    details: string;
    hideDetails: string;
    pickupLocation: string;
    pickupDay: string;
    orderDate: string;
    payment: string;
    payAtPickup: string;
    items: string;
    total: string;
    paymentReminder: string;
    backToHome: string;
    cancelOrder: string;
    cancelConfirmTitle: string;
    cancelConfirmMessage: string;
    cancelYes: string;
    cancelNo: string;
    cancelSuccess: string;
    cancelTooLate: string;
    pending: string;
  };
  about: {
    title: string;
    story: string;
    storyText: string;
    mission: string;
    missionText: string;
    commitment: string;
    commitmentText: string;
    madeWithLove: string;
    madeWithLoveText: string;
    qualityIngredients: string;
    qualityIngredientsText: string;
    communityFocused: string;
    communityFocusedText: string;
  };
  howItWorks: {
    title: string;
    subtitle: string;
    step1Title: string;
    step1Text: string;
    step2Title: string;
    step2Text: string;
    step3Title: string;
    step3Text: string;
    step4Title: string;
    step4Text: string;
    orderingTitle: string;
    cutoffTime: string;
    cutoffText: string;
    preOrder: string;
    preOrderText: string;
    locationsTitle: string;
    pickupTitle: string;
    paymentTitle: string;
    paymentText: string;
    startOrdering: string;
  };
  location: {
    maeRimName: string;
    maeRimAddress: string;
    maeRimDays: string;
    inTownName: string;
    inTownAddress: string;
    inTownDays: string;
    getDirections: string;
    viewOnMaps: string;
    open: string;
  };
  footer: {
    description: string;
    pickupLocations: string;
    contact: string;
    contactLocation: string;
    preOrdersOnly: string;
    paymentInfo: string;
    copyright: string;
  };
  days: {
    friday: string;
    saturday: string;
    sunday: string;
  };
  auth: {
    signUpLogIn: string;
    signUpTitle: string;
    signInTitle: string;
    signIn: string;
    signUp: string;
    createAccount: string;
    email: string;
    emailPlaceholder: string;
    sendLink: string;
    qrLogin: string;
    confirmationMessage: string;
    magicLink: string;
    sendMagicLink: string;
    magicLinkSent: string;
    magicLinkInfo: string;
    noAccount: string;
    haveAccount: string;
    loading: string;
    authError: string;
    signOut: string;
    errorInvalidEmail: string;
    errorGeneric: string;
    orDivider: string;
  };
  profile: {
    completeProfile: string;
    completeProfileMessage: string;
    name: string;
    nameRequired: string;
    phone: string;
    phoneRequired: string;
    contactMethod: string;
    contactMethodHint: string;
    contactRequired: string;
    enterName: string;
    enterPhone: string;
    enterLineId: string;
    enterWhatsApp: string;
    enterWeChatId: string;
    saving: string;
    profileUpdateFailed: string;
  };
  checkoutAuth: {
    signInToCheckout: string;
    signInMessage: string;
    signInSignUp: string;
    continueShopping: string;
  };
  pickupDay: {
    selectPickupDay: string;
    selectDayHelper: string;
    chooseDayPlaceholder: string;
    preordersClosed: string;
    preordersClosedFull: string;
    cutoffWas: string;
    chooseAnotherDay: string;
    dayLocked: string;
    availableFor: string;
    notAvailableFor: string;
    soldOutFor: string;
    maeRimFriday: string;
    maeRimSaturday: string;
    inTownSunday: string;
  };
  dashboard: {
    title: string;
    welcome: string;
    loading: string;
    error: string;
    backToHome: string;
    goToCart: string;
    viewMyQR: string;
    signOut: string;
    profileSection: string;
    editProfile: string;
    saveChanges: string;
    cancelEdit: string;
    name: string;
    email: string;
    phone: string;
    loyaltyPoints: string;
    memberSince: string;
    changePhoto: string;
    removePhoto: string;
    ordersSection: string;
    currentOrders: string;
    pastOrders: string;
    noCurrentOrders: string;
    noPastOrders: string;
    noCurrentOrdersDesc: string;
    noPastOrdersDesc: string;
    orderNumber: string;
    pickupDate: string;
    status: string;
    paymentLabel: string;
    total: string;
    viewDetails: string;
    hideDetails: string;
    pickupOrders: string;
    walkInPurchases: string;
    loyaltySection: string;
    loyaltyDescription: string;
    yourTotalPoints: string;
    keepShopping: string;
    rewardTier: string;
    goldMember: string;
    silverMember: string;
    bronzeMember: string;
    pointsToGold: string;
    pointsToSilver: string;
    favoritesSection: string;
    noFavorites: string;
    noFavoritesDesc: string;
    orderStatus: {
      pending: string;
      confirmed: string;
      ready: string;
      completed: string;
      cancelled: string;
    };
    paymentStatus: {
      pending: string;
      paid: string;
    };
    contactInfo: string;
    lineId: string;
    whatsapp: string;
    wechat: string;
    sortBy: string;
    dateLatest: string;
    dateOldest: string;
    priceHighLow: string;
    priceLowHigh: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    nav: {
      home: 'Home',
      products: 'Products',
      howItWorks: 'How It Works',
      about: 'About',
    },
    hero: {
      title: 'Artisan Bakery in Chiang Mai',
      subtitle: 'Freshly baked goods, made with love. Pre-order for weekend pickup.',
      orderButton: 'Order Now',
    },
    whatWeBake: {
      title: 'What We Bake',
      croissants: {
        name: 'Croissants & Pastries',
        description: 'Buttery, flaky layers made with love and traditional techniques.',
      },
      breads: {
        name: 'Breads',
        description: 'Artisan breads baked fresh with premium ingredients.',
      },
      cakes: {
        name: 'Cakes & Cookies',
        description: 'Sweet treats perfect for any celebration or afternoon delight.',
      },
      quiche: {
        name: 'Quiche, Pizza & More',
        description: 'Savory options including buns, quiche, and artisan pizza.',
      },
    },
    callToAction: {
      title: 'Ready to Pre-Order?',
      subtitle: 'Fresh, handcrafted baked goods made with the finest ingredients.\nOrder today, pick up on your chosen day!',
      buttonText: 'Browse Products',
    },
    categories: {
      title: 'Browse by Category',
      all: 'All Products',
      breads: 'Breads',
      pastries: 'Pastries',
      cakes: 'Cakes',
      cookies: 'Cookies',
    },
    product: {
      addToCart: 'Add to Cart',
      soldOut: 'Sold Out',
      preOrderOnly: 'Pre-order Only',
      cutoffPassed: 'Order Cutoff Passed',
    },
    cart: {
      title: 'Your Cart',
      empty: 'Your cart is empty',
      item: 'item',
      items: 'items',
      total: 'Total',
      checkout: 'Proceed to Checkout',
      continueShopping: 'Continue Shopping',
    },
    checkout: {
      title: 'Checkout',
      contactInfo: 'Contact Information',
      name: 'Full Name',
      email: 'Email Address',
      phone: 'Phone Number',
      lineId: 'LINE ID',
      lineIdPlaceholder: 'Your LINE ID (for order updates)',
      pickupDetails: 'Pickup Details',
      pickupLocation: 'Pickup Location',
      selectLocation: 'Select a pickup location',
      maeRim: 'Mae Rim Bakery (Friday & Saturday)',
      inTown: 'In-Town Location (Sunday only)',
      pickupDay: 'Pickup Day',
      selectDay: 'Select a day',
      orderSummary: 'Order Summary',
      paymentInfo: 'Payment Information',
      paymentInfoText: 'Payment is due upon pickup. We accept cash or Thai QR code payment.',
      placeOrder: 'Place Order',
      processing: 'Processing...',
      required: 'This field is required',
      invalidEmail: 'Invalid email address',
      invalidPhone: 'Invalid phone number',
      authRequired: 'Please log in or sign up to complete your order 🥐',
      loggedInAs: 'You\'re logged in as {{name}}',
      pickupDayFromCatalog: 'Pickup day selected from catalog',
      logIn: 'Sign in with email / QR Code',
      signUp: 'Sign Up',
    },
    confirmation: {
      title: 'Order Confirmed!',
      subtitle: 'Thank you for your order',
      orderNumber: 'Order Number',
      thankYou: 'We\'ve received your order and will have it ready for pickup.',
      details: 'Details',
      hideDetails: 'Hide Details',
      pickupLocation: 'Pickup Location',
      pickupDay: 'Pickup Day',
      orderDate: 'Order Date',
      payment: 'Payment',
      payAtPickup: 'Pay at pickup',
      items: 'Items',
      total: 'Total',
      paymentReminder: 'Please bring cash or be ready to pay via Thai QR code when you pick up your order.',
      backToHome: 'Back to Home',
      cancelOrder: 'Cancel Order',
      cancelConfirmTitle: 'Cancel Order?',
      cancelConfirmMessage: 'Are you sure you want to cancel your order? This cannot be undone.',
      cancelYes: 'Yes, Cancel Order',
      cancelNo: 'Go Back',
      cancelSuccess: 'Your order has been cancelled.',
      cancelTooLate: 'Sorry, this order cannot be cancelled anymore.',
      pending: 'Pending',
    },
    about: {
      title: 'About JOKO TODAY',
      story: 'Our Story',
      storyText: 'JOKO TODAY is a small artisan bakery in Chiang Mai, Thailand, dedicated to creating delicious baked goods with traditional techniques and quality ingredients.',
      mission: 'Our Mission',
      missionText: 'We believe in the simple pleasure of freshly baked bread and pastries. Every item is made with care and attention to detail, bringing warmth and joy to your table.',
      commitment: 'Our Commitment',
      commitmentText: 'We use only the finest ingredients and bake everything fresh to order. By operating on a pre-order basis, we minimize waste and ensure that every item you receive is at its absolute best.',
      madeWithLove: 'Made with Love',
      madeWithLoveText: 'Every item is crafted with care, passion, and attention to detail.',
      qualityIngredients: 'Quality Ingredients',
      qualityIngredientsText: 'We source the finest ingredients to ensure exceptional taste and freshness.',
      communityFocused: 'Community Focused',
      communityFocusedText: 'We\'re proud to serve our local community and build lasting connections.',
    },
    howItWorks: {
      title: 'How It Works',
      subtitle: 'Simple steps to get your fresh baked goods',
      step1Title: 'Browse & Select',
      step1Text: 'Choose from our selection of breads, pastries, cakes, and cookies.',
      step2Title: 'Pre-Order Online',
      step2Text: 'Place your order before the respective cutoff time.',
      step3Title: 'We Bake Fresh',
      step3Text: 'Your items are freshly baked on your selected pickup day.',
      step4Title: 'Pickup & Enjoy',
      step4Text: 'Collect your order at your chosen location and pay on pickup.',
      orderingTitle: 'Ordering Details',
      cutoffTime: 'Order Cutoff',
      cutoffText: 'All orders must be placed by Wednesday at 8:00 PM for weekend pickup.',
      preOrder: 'Pre-Order Only',
      preOrderText: 'All items are made fresh to order. This helps us minimize waste and ensure quality.',
      locationsTitle: 'Pickup Locations & Maps',
      pickupTitle: 'Pickup Schedule',
      paymentTitle: 'Payment Methods',
      paymentText: 'We accept cash or Thai QR code payment at pickup.',
      startOrdering: 'Start Ordering',
    },
    location: {
      maeRimName: 'Mae Rim Bakery',
      maeRimAddress: 'Mae Rim, Chiang Mai, Thailand',
      maeRimDays: 'Friday & Saturday',
      inTownName: 'In-Town Location',
      inTownAddress: 'Chiang Mai, Thailand',
      inTownDays: 'Sunday',
      getDirections: 'Get Directions',
      viewOnMaps: 'View on Maps',
      open: 'Open',
    },
    footer: {
      description: 'Artisan bakery in Chiang Mai, serving freshly baked goods with love and care.',
      pickupLocations: 'Pickup Locations',
      contact: 'Contact',
      contactLocation: 'Chiang Mai, Thailand',
      preOrdersOnly: 'Pre-orders only',
      paymentInfo: 'Payment: Cash or Thai QR code on pickup',
      copyright: 'JOKO TODAY. Baked & Beyond.',
    },
    days: {
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
    },
    auth: {
      signUpLogIn: 'Sign up / Log in',
      signUpTitle: 'Create Account',
      signInTitle: 'Sign In',
      signIn: 'Sign In',
      signUp: 'Sign Up',
      createAccount: 'Create Account',
      email: 'Email Address',
      emailPlaceholder: 'Enter your email address',
      sendLink: 'Send Magic Link',
      qrLogin: 'Sign in with QR Code',
      confirmationMessage: 'We sent an email to your specified email address. Please confirm to sign in.',
      magicLink: 'Magic Link',
      sendMagicLink: 'Send Magic Link',
      magicLinkSent: 'Check your email for the magic link!',
      magicLinkInfo: "We'll send you a secure link to sign in — no password needed",
      noAccount: "Don't have an account?",
      haveAccount: 'Already have an account?',
      loading: 'Sending...',
      authError: 'Authentication failed. Please try again.',
      signOut: 'Sign Out',
      errorInvalidEmail: 'Please enter a valid email address.',
      errorGeneric: 'Something went wrong. Please try again.',
      orDivider: 'or',
    },
    profile: {
      completeProfile: 'Complete Your Profile',
      completeProfileMessage: 'Please complete your profile to proceed with checkout',
      name: 'Name / Nickname',
      nameRequired: 'Name is required',
      phone: 'Phone Number',
      phoneRequired: 'Phone number is required',
      contactMethod: 'Contact Method',
      contactMethodHint: 'Please provide at least one contact method',
      contactRequired: 'At least one contact method is required',
      enterName: 'Enter your name',
      enterPhone: 'Enter your phone number',
      enterLineId: 'Enter your LINE ID',
      enterWhatsApp: 'Enter your WhatsApp',
      enterWeChatId: 'Enter your WeChat ID',
      saving: 'Saving...',
      profileUpdateFailed: 'Failed to update profile',
    },
    checkoutAuth: {
      signInToCheckout: 'Sign in to checkout',
      signInMessage: 'Create an account or sign in to complete your order',
      signInSignUp: 'Sign In / Sign Up',
      continueShopping: 'Continue Shopping',
    },
    pickupDay: {
      selectPickupDay: 'Select your pickup day',
      selectDayHelper: 'Please choose your pickup day to see what\'s available 🥐',
      chooseDayPlaceholder: 'Choose a day...',
      preordersClosed: 'Pre-orders closed',
      preordersClosedFull: 'Pre-orders for this day are closed. Please choose another pickup day.',
      cutoffWas: 'Cutoff was',
      chooseAnotherDay: 'Please choose another day.',
      dayLocked: 'Your pickup day is locked for this order.',
      availableFor: 'Available for',
      notAvailableFor: 'Not available on',
      soldOutFor: 'Sold out for',
      maeRimFriday: 'Friday – Mae Rim',
      maeRimSaturday: 'Saturday – Mae Rim',
      inTownSunday: 'Sunday – In-Town',
    },
    dashboard: {
      title: 'My Account',
      welcome: 'Welcome back',
      loading: 'Loading...',
      error: 'Failed to load account',
      backToHome: 'Back to Home',
      goToCart: 'Go to Cart',
      viewMyQR: 'View My QR',
      signOut: 'Sign Out',
      profileSection: 'My Profile',
      editProfile: 'Edit Profile',
      saveChanges: 'Save Changes',
      cancelEdit: 'Cancel',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      loyaltyPoints: 'Loyalty Points',
      memberSince: 'Member since',
      changePhoto: 'Change Photo',
      removePhoto: 'Remove Photo',
      ordersSection: 'My Orders',
      currentOrders: 'Current Orders',
      pastOrders: 'Past Orders',
      noCurrentOrders: 'No current orders',
      noPastOrders: 'No past orders',
      noCurrentOrdersDesc: 'Your active orders will appear here',
      noPastOrdersDesc: 'Your order history will appear here',
      orderNumber: 'Order',
      pickupDate: 'Pickup',
      status: 'Status',
      paymentLabel: 'Payment',
      total: 'Total',
      viewDetails: 'View Details',
      hideDetails: 'Hide Details',
      pickupOrders: 'Pick-Up Orders',
      walkInPurchases: 'Walk-In Purchases',
      loyaltySection: 'Total Loyalty Points Earned',
      loyaltyDescription: 'Keep shopping to earn more rewards!',
      yourTotalPoints: 'Your Total Points',
      keepShopping: 'Keep shopping to earn more rewards!',
      rewardTier: 'Reward Tier',
      goldMember: 'Gold Member',
      silverMember: 'Silver Member',
      bronzeMember: 'Bronze Member',
      pointsToGold: 'points to Gold',
      pointsToSilver: 'points to Silver',
      favoritesSection: 'My Favorite Items',
      noFavorites: 'No favorites yet',
      noFavoritesDesc: 'Start adding your favorite items by tapping the heart icon',
      orderStatus: {
        pending: 'Pending',
        confirmed: 'Confirmed',
        ready: 'Ready for Pickup',
        completed: 'Completed',
        cancelled: 'Cancelled',
      },
      paymentStatus: {
        pending: 'Pending',
        paid: 'Paid',
      },
      contactInfo: 'Contact Information',
      lineId: 'LINE ID',
      whatsapp: 'WhatsApp',
      wechat: 'WeChat',
      sortBy: 'Sort by',
      dateLatest: 'Date (Latest First)',
      dateOldest: 'Date (Oldest First)',
      priceHighLow: 'Price (High to Low)',
      priceLowHigh: 'Price (Low to High)',
    },
  },
  th: {
    nav: {
      home: 'หน้าหลัก',
      products: 'สินค้า',
      howItWorks: 'วิธีการสั่งซื้อ',
      about: 'เกี่ยวกับเรา',
    },
    hero: {
      title: 'เบเกอรี่ช่างฝีมือในเชียงใหม่',
      subtitle: 'ขนมปังและเบเกอรี่สดใหม่ ทำด้วยใจรัก สั่งจองล่วงหน้าสำหรับรับของสุดสัปดาห์',
      orderButton: 'สั่งซื้อเลย',
    },
    whatWeBake: {
      title: 'สิ่งที่เราอบ',
      croissants: {
        name: 'ครัวซองและเพสทรี้',
        description: 'ชั้นเนยกรอบนอกนุ่มในทำด้วยใจรักและเทคนิคแบบดั้งเดิม',
      },
      breads: {
        name: 'ขนมปัง',
        description: 'ขนมปังช่างฝีมืออบสดใหม่ด้วยวัตถุดิบคุณภาพเยี่ยม',
      },
      cakes: {
        name: 'เค้กและคุกกี้',
        description: 'ขนมหวานสุดอร่อยเพื่อการเฉลิมฉลองหรือติดตามหลังบ่าย',
      },
      quiche: {
        name: 'คีช พิซซ่า และอื่นๆ',
        description: 'เมนูคร่อมรวมถึงขนมปังชนิดต่างๆ คีช และพิซซ่าช่างฝีมือ',
      },
    },
    callToAction: {
      title: 'พร้อมสั่งพรีออเดอร์แล้วหรือยัง?',
      subtitle: 'เบเกอรี่โฮมเมด อบสดใหม่เป็นรอบเล็ก ๆ ด้วยวัตถุดิบคุณภาพ\nสั่งวันนี้ รับในวันที่คุณเลือก',
      buttonText: 'ดูสินค้า',
    },
    categories: {
      title: 'เลือกดูตามประเภท',
      all: 'สินค้าทั้งหมด',
      breads: 'ขนมปัง',
      pastries: 'เพสทรี้',
      cakes: 'เค้ก',
      cookies: 'คุกกี้',
    },
    product: {
      addToCart: 'ใส่ตะกร้า',
      soldOut: 'ขายหมดแล้ว',
      preOrderOnly: 'สั่งจองล่วงหน้าเท่านั้น',
      cutoffPassed: 'เลยกำหนดสั่งซื้อแล้ว',
    },
    cart: {
      title: 'ตะกร้าของคุณ',
      empty: 'ตะกร้าของคุณว่างเปล่า',
      item: 'รายการ',
      items: 'รายการ',
      total: 'รวมทั้งหมด',
      checkout: 'ดำเนินการชำระเงิน',
      continueShopping: 'เลือกซื้อสินค้าต่อ',
    },
    checkout: {
      title: 'ชำระเงิน',
      contactInfo: 'ข้อมูลติดต่อ',
      name: 'ชื่อ-นามสกุล',
      email: 'อีเมล',
      phone: 'หมายเลขโทรศัพท์',
      lineId: 'ไลน์ไอดี',
      lineIdPlaceholder: 'ไลน์ไอดีของคุณ (สำหรับแจ้งข้อมูลออเดอร์)',
      pickupDetails: 'รายละเอียดการรับสินค้า',
      pickupLocation: 'สถานที่รับสินค้า',
      selectLocation: 'เลือกสถานที่รับสินค้า',
      maeRim: 'เบเกอรี่แม่ริม (ศุกร์และเสาร์)',
      inTown: 'จุดรับในเมือง (อาทิตย์เท่านั้น)',
      pickupDay: 'วันที่รับสินค้า',
      selectDay: 'เลือกวัน',
      orderSummary: 'สรุปรายการสั่งซื้อ',
      paymentInfo: 'ข้อมูลการชำระเงิน',
      paymentInfoText: 'ชำระเงินเมื่อมารับสินค้า รับชำระเงินสดหรือพร้อมเพย์',
      placeOrder: 'สั่งซื้อ',
      processing: 'กำลังดำเนินการ...',
      required: 'กรุณากรอกข้อมูลนี้',
      invalidEmail: 'อีเมลไม่ถูกต้อง',
      invalidPhone: 'หมายเลขโทรศัพท์ไม่ถูกต้อง',
      authRequired: 'กรุณาเข้าสู่ระบบหรือสมัครสมาชิกเพื่อดำเนินการสั่งซื้อ 🥐',
      loggedInAs: 'คุณเข้าสู่ระบบในนาม {{name}}',
      pickupDayFromCatalog: 'วันรับสินค้าถูกเลือกจากหน้ารายการสินค้าแล้ว',
      logIn: 'เข้าสู่ระบบด้วยอีเมล / QR Code',
      signUp: 'สมัครสมาชิก',
    },
    confirmation: {
      title: 'ยืนยันคำสั่งซื้อแล้ว!',
      subtitle: 'ขอบคุณสำหรับคำสั่งซื้อของคุณ',
      orderNumber: 'หมายเลขคำสั่งซื้อ',
      thankYou: 'เราได้รับคำสั่งซื้อของคุณแล้ว และจะเตรียมสินค้าให้พร้อมสำหรับรับ',
      details: 'รายละเอียด',
      hideDetails: 'ซ่อนรายละเอียด',
      pickupLocation: 'สถานที่รับสินค้า',
      pickupDay: 'วันที่รับสินค้า',
      orderDate: 'วันที่สั่งซื้อ',
      payment: 'การชำระเงิน',
      payAtPickup: 'ชำระเมื่อรับสินค้า',
      items: 'รายการสินค้า',
      total: 'รวมทั้งหมด',
      paymentReminder: 'กรุณานำเงินสดหรือเตรียมพร้อมเพย์เมื่อมารับสินค้า',
      backToHome: 'กลับสู่หน้าหลัก',
      cancelOrder: 'ยกเลิกคำสั่งซื้อ',
      cancelConfirmTitle: 'ยกเลิกคำสั่งซื้อ?',
      cancelConfirmMessage: 'คุณแน่ใจหรือไม่ว่าต้องการยกเลิกคำสั่งซื้อ? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
      cancelYes: 'ใช่ ยกเลิกคำสั่งซื้อ',
      cancelNo: 'กลับไป',
      cancelSuccess: 'คำสั่งซื้อของคุณถูกยกเลิกแล้ว',
      cancelTooLate: 'ขออภัย คำสั่งซื้อนี้ไม่สามารถยกเลิกได้แล้ว',
      pending: 'รอดำเนินการ',
    },
    about: {
      title: 'เกี่ยวกับ JOKO TODAY',
      story: 'เรื่องราวของเรา',
      storyText: 'JOKO TODAY เป็นเบเกอรี่ช่างฝีมือขนาดเล็กในเชียงใหม่ ประเทศไทย มุ่งมั่นสร้างสรรค์ขนมอบแสนอร่อยด้วยเทคนิคแบบดั้งเดิมและวัตถุดิบคุณภาพ',
      mission: 'พันธกิจของเรา',
      missionText: 'เราเชื่อในความสุขเรียบง่ายของขนมปังและเพสทรี้สดใหม่ ทุกชิ้นทำด้วยความใส่ใจและรายละเอียด นำความอบอุ่นและความสุขมาสู่โต๊ะอาหารของคุณ',
      commitment: 'ความมุ่งมั่นของเรา',
      commitmentText: 'เราใช้วัตถุดิบชั้นดีเท่านั้น และอบทุกอย่างสดใหม่ตามออเดอร์ การทำงานแบบสั่งจองล่วงหน้าช่วยลดของเสียและรับประกันว่าทุกชิ้นที่คุณได้รับอยู่ในสภาพที่ดีที่สุด',
      madeWithLove: 'ทำด้วยใจรัก',
      madeWithLoveText: 'ทุกชิ้นผลิตด้วยความใส่ใจ ความหลงใหล และรายละเอียด',
      qualityIngredients: 'วัตถุดิบคุณภาพ',
      qualityIngredientsText: 'เราคัดสรรวัตถุดิบชั้นดีเยี่ยมเพื่อให้มั่นใจถึงรสชาติอันยอดเยี่ยมและความสดใหม่',
      communityFocused: 'เน้นความเป็นชุมชน',
      communityFocusedText: 'เราภูมิใจที่บริการชุมชนท้องถิ่นและสร้างสัมพันธ์อันยาวนาน',
    },
    howItWorks: {
      title: 'วิธีการสั่งซื้อ',
      subtitle: 'ขั้นตอนง่ายๆ ในการรับขนมอบสดใหม่',
      step1Title: 'เลือกสินค้า',
      step1Text: 'เลือกจากขนมปัง เพสทรี้ เค้ก และคุกกี้ของเรา',
      step2Title: 'สั่งจองล่วงหน้า',
      step2Text: 'สั่งซื้อก่อนเวลาปิดรับออเดอร์',
      step3Title: 'เราอบสดใหม่',
      step3Text: 'สินค้าของคุณจะถูกอบสดใหม่ในวันที่คุณเลือกรับสินค้า',
      step4Title: 'รับสินค้าและเพลิดเพลิน',
      step4Text: 'มารับออเดอร์ที่สถานที่ที่คุณเลือก และชำระเงินเมื่อรับสินค้า',
      orderingTitle: 'รายละเอียดการสั่งซื้อ',
      cutoffTime: 'เวลาปิดรับออเดอร์',
      cutoffText: 'ต้องสั่งซื้อทั้งหมดภายในวันพุธ เวลา 20:00 น. สำหรับรับสินค้าสุดสัปดาห์',
      preOrder: 'สั่งจองล่วงหน้าเท่านั้น',
      preOrderText: 'สินค้าทั้งหมดทำสดใหม่ตามออเดอร์ วิธีนี้ช่วยลดของเสียและรับประกันคุณภาพ',
      locationsTitle: 'สถานที่รับสินค้าและแผนที่',
      pickupTitle: 'ตารางรับสินค้า',
      paymentTitle: 'วิธีชำระเงิน',
      paymentText: 'รับชำระเงินสดหรือพร้อมเพย์เมื่อรับสินค้า',
      startOrdering: 'เริ่มสั่งซื้อ',
    },
    location: {
      maeRimName: 'เบเกอรี่แม่ริม',
      maeRimAddress: 'แม่ริม เชียงใหม่ ประเทศไทย',
      maeRimDays: 'ศุกร์และเสาร์',
      inTownName: 'จุดรับในเมือง',
      inTownAddress: 'เชียงใหม่ ประเทศไทย',
      inTownDays: 'อาทิตย์',
      getDirections: 'เส้นทาง',
      viewOnMaps: 'ดูบนแผนที่',
      open: 'เปิด',
    },
    footer: {
      description: 'เบเกอรี่ช่างฝีมือในเชียงใหม่ เสิร์ฟขนมอบสดใหม่ด้วยความรักและใส่ใจ',
      pickupLocations: 'สถานที่รับสินค้า',
      contact: 'ติดต่อเรา',
      contactLocation: 'เชียงใหม่ ประเทศไทย',
      preOrdersOnly: 'รับสั่งจองล่วงหน้าเท่านั้น',
      paymentInfo: 'ชำระเงิน: เงินสดหรือพร้อมเพย์เมื่อรับสินค้า',
      copyright: 'JOKO TODAY. อบด้วยใจ เหนือความคาดหมาย',
    },
    days: {
      friday: 'ศุกร์',
      saturday: 'เสาร์',
      sunday: 'อาทิตย์',
    },
    auth: {
      signUpLogIn: 'สมัครสมาชิก / เข้าสู่ระบบ',
      signUpTitle: 'สมัครสมาชิก',
      signInTitle: 'เข้าสู่ระบบ',
      signIn: 'เข้าสู่ระบบ',
      signUp: 'สมัครสมาชิก',
      createAccount: 'สร้างบัญชี',
      email: 'อีเมล',
      emailPlaceholder: 'กรอกที่อยู่อีเมลของคุณ',
      sendLink: 'ส่งลิงก์เข้าสู่ระบบ',
      qrLogin: 'เข้าสู่ระบบด้วย QR โค้ด',
      confirmationMessage: 'เราได้ส่งอีเมลไปยังที่อยู่อีเมลที่คุณระบุแล้ว กรุณาตรวจสอบและยืนยันเพื่อเข้าสู่ระบบ',
      magicLink: 'ลิงก์เข้าสู่ระบบ',
      sendMagicLink: 'ส่งลิงก์เข้าสู่ระบบ',
      magicLinkSent: 'กรุณาตรวจสอบอีเมลของคุณสำหรับลิงก์เข้าสู่ระบบ!',
      magicLinkInfo: 'เราจะส่งลิงก์ปลอดภัยให้คุณเพื่อเข้าสู่ระบบ — ไม่ต้องใช้รหัสผ่าน',
      noAccount: 'ยังไม่มีบัญชี?',
      haveAccount: 'มีบัญชีแล้ว?',
      loading: 'กำลังส่ง...',
      authError: 'การยืนยันตัวตนล้มเหลว กรุณาลองอีกครั้ง',
      signOut: 'ออกจากระบบ',
      errorInvalidEmail: 'กรุณากรอกที่อยู่อีเมลที่ถูกต้อง',
      errorGeneric: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง',
      orDivider: 'หรือ',
    },
    profile: {
      completeProfile: 'กรอกข้อมูลโปรไฟล์',
      completeProfileMessage: 'กรุณากรอกข้อมูลโปรไฟล์เพื่อดำเนินการชำระเงินต่อ',
      name: 'ชื่อ / ชื่อเล่น',
      nameRequired: 'กรุณากรอกชื่อ',
      phone: 'หมายเลขโทรศัพท์',
      phoneRequired: 'กรุณากรอกหมายเลขโทรศัพท์',
      contactMethod: 'วิธีการติดต่อ',
      contactMethodHint: 'กรุณาระบุวิธีการติดต่ออย่างน้อยหนึ่งวิธี',
      contactRequired: 'กรุณาระบุวิธีการติดต่ออย่างน้อยหนึ่งวิธี',
      enterName: 'กรอกชื่อของคุณ',
      enterPhone: 'กรอกหมายเลขโทรศัพท์',
      enterLineId: 'กรอกไลน์ไอดีของคุณ',
      enterWhatsApp: 'กรอกวอทส์แอพของคุณ',
      enterWeChatId: 'กรอกวีแชทไอดีของคุณ',
      saving: 'กำลังบันทึก...',
      profileUpdateFailed: 'ไม่สามารถอัปเดตโปรไฟล์ได้',
    },
    checkoutAuth: {
      signInToCheckout: 'เข้าสู่ระบบเพื่อชำระเงิน',
      signInMessage: 'สร้างบัญชีหรือเข้าสู่ระบบเพื่อทำการสั่งซื้อ',
      signInSignUp: 'เข้าสู่ระบบ / สมัครสมาชิก',
      continueShopping: 'เลือกซื้อสินค้าต่อ',
    },
    pickupDay: {
      selectPickupDay: 'เลือกวันรับสินค้า',
      selectDayHelper: 'กรุณาเลือกวันรับสินค้าเพื่อดูรายการที่มีจำหน่าย 🥐',
      chooseDayPlaceholder: 'เลือกวัน...',
      preordersClosed: 'ปิดรับออเดอร์',
      preordersClosedFull: 'ปิดรับออเดอร์สำหรับวันนี้แล้ว กรุณาเลือกวันรับสินค้าอื่น',
      cutoffWas: 'เวลาปิดรับออเดอร์คือ',
      chooseAnotherDay: 'กรุณาเลือกวันอื่น',
      dayLocked: 'วันรับสินค้าของคุณถูกล็อกไว้สำหรับออเดอร์นี้แล้ว',
      availableFor: 'มีจำหน่ายสำหรับ',
      notAvailableFor: 'ไม่มีจำหน่ายในวัน',
      soldOutFor: 'สินค้าหมดสำหรับวัน',
      maeRimFriday: 'วันศุกร์ – แม่ริม',
      maeRimSaturday: 'วันเสาร์ – แม่ริม',
      inTownSunday: 'วันอาทิตย์ – ในเมือง',
    },
    dashboard: {
      title: 'บัญชีของฉัน',
      welcome: 'ยินดีต้อนรับกลับมา',
      loading: 'กำลังโหลด...',
      error: 'ไม่สามารถโหลดบัญชีได้',
      backToHome: 'กลับสู่หน้าหลัก',
      goToCart: 'ไปยังตะกร้า',
      viewMyQR: 'ดู QR ของฉัน',
      signOut: 'ออกจากระบบ',
      profileSection: 'โปรไฟล์ของฉัน',
      editProfile: 'แก้ไขโปรไฟล์',
      saveChanges: 'บันทึกการเปลี่ยนแปลง',
      cancelEdit: 'ยกเลิก',
      name: 'ชื่อ',
      email: 'อีเมล',
      phone: 'โทรศัพท์',
      loyaltyPoints: 'คะแนนสะสม',
      memberSince: 'สมาชิกตั้งแต่',
      changePhoto: 'เปลี่ยนรูป',
      removePhoto: 'ลบรูป',
      ordersSection: 'ออเดอร์ของฉัน',
      currentOrders: 'ออเดอร์ปัจจุบัน',
      pastOrders: 'ออเดอร์ที่ผ่านมา',
      noCurrentOrders: 'ไม่มีออเดอร์ปัจจุบัน',
      noPastOrders: 'ไม่มีออเดอร์ที่ผ่านมา',
      noCurrentOrdersDesc: 'ออเดอร์ที่กำลังดำเนินการจะแสดงที่นี่',
      noPastOrdersDesc: 'ประวัติการสั่งซื้อจะแสดงที่นี่',
      orderNumber: 'ออเดอร์',
      pickupDate: 'วันรับสินค้า',
      status: 'สถานะ',
      paymentLabel: 'การชำระเงิน',
      total: 'รวม',
      viewDetails: 'ดูรายละเอียด',
      hideDetails: 'ซ่อนรายละเอียด',
      pickupOrders: 'ออเดอร์รับสินค้า',
      walkInPurchases: 'การซื้อหน้าร้าน',
      loyaltySection: 'คะแนนสะสมทั้งหมด',
      loyaltyDescription: 'ซื้อต่อเพื่อรับรางวัลมากขึ้น!',
      yourTotalPoints: 'คะแนนรวมของคุณ',
      keepShopping: 'ซื้อต่อเพื่อรับรางวัลมากขึ้น!',
      rewardTier: 'ระดับสมาชิก',
      goldMember: 'สมาชิกทอง',
      silverMember: 'สมาชิกเงิน',
      bronzeMember: 'สมาชิกทองแดง',
      pointsToGold: 'คะแนนถึงระดับทอง',
      pointsToSilver: 'คะแนนถึงระดับเงิน',
      favoritesSection: 'รายการโปรด',
      noFavorites: 'ยังไม่มีรายการโปรด',
      noFavoritesDesc: 'เริ่มเพิ่มรายการโปรดโดยแตะไอคอนหัวใจ',
      orderStatus: {
        pending: 'รอดำเนินการ',
        confirmed: 'ยืนยันแล้ว',
        ready: 'พร้อมรับสินค้า',
        completed: 'เสร็จสิ้น',
        cancelled: 'ยกเลิก',
      },
      paymentStatus: {
        pending: 'รอชำระเงิน',
        paid: 'ชำระแล้ว',
      },
      contactInfo: 'ข้อมูลติดต่อ',
      lineId: 'ไลน์ไอดี',
      whatsapp: 'วอทส์แอพ',
      wechat: 'วีแชท',
      sortBy: 'เรียงตาม',
      dateLatest: 'วันที่ (ล่าสุดก่อน)',
      dateOldest: 'วันที่ (เก่าสุดก่อน)',
      priceHighLow: 'ราคา (สูงไปต่ำ)',
      priceLowHigh: 'ราคา (ต่ำไปสูง)',
    },
  },
  zh: {
    nav: {
      home: '首页',
      products: '产品',
      howItWorks: '订购指南',
      about: '关于我们',
    },
    hero: {
      title: '清迈手工烘焙坊',
      subtitle: '新鲜烘焙，用心制作。预订周末取货。',
      orderButton: '立即订购',
    },
    whatWeBake: {
      title: '我们的烘焙',
      croissants: {
        name: '可颂与酥点',
        description: '传统工艺，层层酥香，满满黄油香气。',
      },
      breads: {
        name: '面包',
        description: '优质原料，新鲜出炉的手工面包。',
      },
      cakes: {
        name: '蛋糕与饼干',
        description: '庆祝时刻或午后茶点的甜蜜选择。',
      },
      quiche: {
        name: '法式咸派、披萨等',
        description: '包括各式面包、法式咸派和手工披萨。',
      },
    },
    callToAction: {
      title: '准备好预订了吗？',
      subtitle: '优质原料，小批量新鲜烘焙。\n今日下单，指定日期取货！',
      buttonText: '浏览产品',
    },
    categories: {
      title: '按类别浏览',
      all: '全部产品',
      breads: '面包',
      pastries: '酥点',
      cakes: '蛋糕',
      cookies: '饼干',
    },
    product: {
      addToCart: '加入购物车',
      soldOut: '已售罄',
      preOrderOnly: '仅接受预订',
      cutoffPassed: '订购已截止',
    },
    cart: {
      title: '购物车',
      empty: '购物车是空的',
      item: '件',
      items: '件',
      total: '合计',
      checkout: '去结账',
      continueShopping: '继续购物',
    },
    checkout: {
      title: '结账',
      contactInfo: '联系信息',
      name: '姓名',
      email: '电子邮箱',
      phone: '电话号码',
      lineId: 'LINE ID',
      lineIdPlaceholder: '您的 LINE ID（用于订单更新）',
      pickupDetails: '取货详情',
      pickupLocation: '取货地点',
      selectLocation: '选择取货地点',
      maeRim: '湄林烘焙坊（周五和周六）',
      inTown: '市区取货点（仅限周日）',
      pickupDay: '取货日期',
      selectDay: '选择日期',
      orderSummary: '订单摘要',
      paymentInfo: '付款信息',
      paymentInfoText: '取货时付款。接受现金或泰国二维码支付。',
      placeOrder: '提交订单',
      processing: '处理中...',
      required: '此项必填',
      invalidEmail: '邮箱格式不正确',
      invalidPhone: '电话号码格式不正确',
      authRequired: '请登录或注册以完成订单',
      loggedInAs: '您已登录为 {{name}}',
      pickupDayFromCatalog: '取货日期已从目录选择',
      logIn: '使用邮箱/二维码登录',
      signUp: '注册',
    },
    confirmation: {
      title: '订单已确认！',
      subtitle: '感谢您的订购',
      orderNumber: '订单号',
      thankYou: '我们已收到您的订单，将为您准备好取货。',
      details: '详情',
      hideDetails: '隐藏详情',
      pickupLocation: '取货地点',
      pickupDay: '取货日期',
      orderDate: '下单日期',
      payment: '支付方式',
      payAtPickup: '取货时付款',
      items: '商品',
      total: '合计',
      paymentReminder: '取货时请准备现金或泰国二维码支付。',
      backToHome: '返回首页',
      cancelOrder: '取消订单',
      cancelConfirmTitle: '取消订单？',
      cancelConfirmMessage: '您确定要取消订单吗？此操作无法撤销。',
      cancelYes: '是，取消订单',
      cancelNo: '返回',
      cancelSuccess: '您的订单已取消。',
      cancelTooLate: '抱歉，此订单已无法取消。',
      pending: '待处理',
    },
    about: {
      title: '关于 JOKO TODAY',
      story: '我们的故事',
      storyText: 'JOKO TODAY 是位于泰国清迈的小型手工烘焙坊，致力于用传统工艺和优质原料制作美味烘焙食品。',
      mission: '我们的使命',
      missionText: '我们相信新鲜面包和酥点带来的简单快乐。每一件产品都用心制作，为您的餐桌带来温暖和幸福。',
      commitment: '我们的承诺',
      commitmentText: '我们只使用最优质的原料，按订单新鲜烘焙。预订模式帮助我们减少浪费，确保您收到的每一件产品都处于最佳状态。',
      madeWithLove: '用心制作',
      madeWithLoveText: '每件产品都经过精心制作，注重细节。',
      qualityIngredients: '优质原料',
      qualityIngredientsText: '我们精选最优质的原料，确保卓越的口感和新鲜度。',
      communityFocused: '扎根社区',
      communityFocusedText: '我们很自豪能为本地社区服务，建立持久的联系。',
    },
    howItWorks: {
      title: '订购指南',
      subtitle: '轻松几步，获取新鲜烘焙',
      step1Title: '浏览与选择',
      step1Text: '从我们的面包、酥点、蛋糕和饼干中选择。',
      step2Title: '在线预订',
      step2Text: '在截止时间前下单。',
      step3Title: '新鲜烘焙',
      step3Text: '您的商品将在取货当天新鲜出炉。',
      step4Title: '取货享用',
      step4Text: '在指定地点取货并付款。',
      orderingTitle: '订购详情',
      cutoffTime: '订购截止',
      cutoffText: '所有订单须在周三晚上8点前提交，周末取货。',
      preOrder: '仅接受预订',
      preOrderText: '所有商品按订单新鲜制作。这帮助我们减少浪费并确保品质。',
      locationsTitle: '取货地点与地图',
      pickupTitle: '取货时间表',
      paymentTitle: '付款方式',
      paymentText: '取货时接受现金或泰国二维码支付。',
      startOrdering: '开始订购',
    },
    location: {
      maeRimName: '湄林烘焙坊',
      maeRimAddress: '泰国清迈湄林',
      maeRimDays: '周五和周六',
      inTownName: '市区取货点',
      inTownAddress: '泰国清迈',
      inTownDays: '周日',
      getDirections: '获取路线',
      viewOnMaps: '在地图上查看',
      open: '营业中',
    },
    footer: {
      description: '清迈手工烘焙坊，用爱心制作新鲜烘焙食品。',
      pickupLocations: '取货地点',
      contact: '联系我们',
      contactLocation: '泰国清迈',
      preOrdersOnly: '仅接受预订',
      paymentInfo: '付款：取货时现金或泰国二维码',
      copyright: 'JOKO TODAY。烘焙与超越。',
    },
    days: {
      friday: '周五',
      saturday: '周六',
      sunday: '周日',
    },
    auth: {
      signUpLogIn: '注册 / 登录',
      signUpTitle: '创建账户',
      signInTitle: '登录',
      signIn: '登录',
      signUp: '注册',
      createAccount: '创建账户',
      email: '电子邮箱',
      emailPlaceholder: '请输入您的电子邮箱地址',
      sendLink: '发送登录链接',
      qrLogin: '使用二维码登录',
      confirmationMessage: '我们已向您提供的电子邮箱发送了一封邮件。请确认邮件以完成登录。',
      magicLink: '登录链接',
      sendMagicLink: '发送登录链接',
      magicLinkSent: '请检查您的邮箱获取登录链接！',
      magicLinkInfo: '我们将发送安全链接，无需密码即可登录',
      noAccount: '还没有账户？',
      haveAccount: '已有账户？',
      loading: '发送中...',
      authError: '认证失败，请重试。',
      signOut: '退出登录',
      errorInvalidEmail: '请输入有效的电子邮箱地址。',
      errorGeneric: '出了点问题，请重试。',
      orDivider: '或',
    },
    profile: {
      completeProfile: '完善个人资料',
      completeProfileMessage: '请完善您的个人资料以继续结账',
      name: '姓名 / 昵称',
      nameRequired: '请填写姓名',
      phone: '电话号码',
      phoneRequired: '请填写电话号码',
      contactMethod: '联系方式',
      contactMethodHint: '请提供至少一种联系方式',
      contactRequired: '请提供至少一种联系方式',
      enterName: '输入您的姓名',
      enterPhone: '输入您的电话号码',
      enterLineId: '输入您的 LINE ID',
      enterWhatsApp: '输入您的 WhatsApp',
      enterWeChatId: '输入您的微信 ID',
      saving: '保存中...',
      profileUpdateFailed: '个人资料更新失败',
    },
    checkoutAuth: {
      signInToCheckout: '登录以结账',
      signInMessage: '创建账户或登录以完成订单',
      signInSignUp: '登录 / 注册',
      continueShopping: '继续购物',
    },
    pickupDay: {
      selectPickupDay: '选择取货日期',
      selectDayHelper: '请选择取货日期以查看可用商品',
      chooseDayPlaceholder: '选择日期...',
      preordersClosed: '预订已结束',
      preordersClosedFull: '此日期预订已结束。请选择其他取货日期。',
      cutoffWas: '截止时间为',
      chooseAnotherDay: '请选择其他日期。',
      dayLocked: '此订单的取货日期已锁定。',
      availableFor: '可供选择',
      notAvailableFor: '不可选择于',
      soldOutFor: '已售罄于',
      maeRimFriday: '周五 – 湄林',
      maeRimSaturday: '周六 – 湄林',
      inTownSunday: '周日 – 市区',
    },
    dashboard: {
      title: '我的账户',
      welcome: '欢迎回来',
      loading: '加载中...',
      error: '无法加载账户',
      backToHome: '返回首页',
      goToCart: '前往购物车',
      viewMyQR: '查看我的二维码',
      signOut: '退出登录',
      profileSection: '我的个人资料',
      editProfile: '编辑个人资料',
      saveChanges: '保存更改',
      cancelEdit: '取消',
      name: '姓名',
      email: '邮箱',
      phone: '电话',
      loyaltyPoints: '积分',
      memberSince: '会员自',
      changePhoto: '更换头像',
      removePhoto: '删除头像',
      ordersSection: '我的订单',
      currentOrders: '当前订单',
      pastOrders: '历史订单',
      noCurrentOrders: '暂无当前订单',
      noPastOrders: '暂无历史订单',
      noCurrentOrdersDesc: '您的活跃订单将显示在这里',
      noPastOrdersDesc: '您的订单历史将显示在这里',
      orderNumber: '订单',
      pickupDate: '取货日期',
      status: '状态',
      paymentLabel: '付款',
      total: '合计',
      viewDetails: '查看详情',
      hideDetails: '隐藏详情',
      pickupOrders: '取货订单',
      walkInPurchases: '到店购买',
      loyaltySection: '累计积分总额',
      loyaltyDescription: '继续购物获得更多奖励！',
      yourTotalPoints: '您的总积分',
      keepShopping: '继续购物获得更多奖励！',
      rewardTier: '会员等级',
      goldMember: '金卡会员',
      silverMember: '银卡会员',
      bronzeMember: '铜卡会员',
      pointsToGold: '积分达到金卡',
      pointsToSilver: '积分达到银卡',
      favoritesSection: '我的收藏',
      noFavorites: '暂无收藏',
      noFavoritesDesc: '点击心形图标开始收藏您喜欢的商品',
      orderStatus: {
        pending: '待处理',
        confirmed: '已确认',
        ready: '准备取货',
        completed: '已完成',
        cancelled: '已取消',
      },
      paymentStatus: {
        pending: '待付款',
        paid: '已付款',
      },
      contactInfo: '联系信息',
      lineId: 'LINE ID',
      whatsapp: 'WhatsApp',
      wechat: '微信',
      sortBy: '排序',
      dateLatest: '日期（最新优先）',
      dateOldest: '日期（最早优先）',
      priceHighLow: '价格（从高到低）',
      priceLowHigh: '价格（从低到高）',
    },
  },
};
