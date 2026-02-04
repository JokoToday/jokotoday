export type Language = 'en' | 'th';

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
    pickupLocation: string;
    pickupDay: string;
    total: string;
    paymentReminder: string;
    backToHome: string;
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
    signIn: string;
    signUp: string;
    createAccount: string;
    email: string;
    password: string;
    magicLink: string;
    sendMagicLink: string;
    magicLinkSent: string;
    magicLinkInfo: string;
    noAccount: string;
    haveAccount: string;
    loading: string;
    authError: string;
    signOut: string;
    forgotPassword: string;
    resetPassword: string;
    resetPasswordMessage: string;
    sendResetLink: string;
    resetLinkSent: string;
    newPassword: string;
    confirmPassword: string;
    passwordMismatch: string;
    passwordMinLength: string;
    updatePassword: string;
    passwordResetFailed: string;
    passwordResetSuccess: string;
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
      details: 'Order Details',
      pickupLocation: 'Pickup Location',
      pickupDay: 'Pickup Day',
      total: 'Total',
      paymentReminder: 'Please bring cash or be ready to pay via Thai QR code when you pick up your order.',
      backToHome: 'Back to Home',
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
      signIn: 'Sign In',
      signUp: 'Sign Up',
      createAccount: 'Create Account',
      email: 'Email Address',
      password: 'Password',
      magicLink: 'Magic Link',
      sendMagicLink: 'Send Magic Link',
      magicLinkSent: 'Check your email for the magic link!',
      magicLinkInfo: "We'll send you a secure link to sign in without a password",
      noAccount: "Don't have an account?",
      haveAccount: 'Already have an account?',
      loading: 'Loading...',
      authError: 'Authentication failed',
      signOut: 'Sign Out',
      forgotPassword: 'Forgot your password?',
      resetPassword: 'Reset your password',
      resetPasswordMessage: 'Enter your email and we\'ll send you a reset link.',
      sendResetLink: 'Send reset link',
      resetLinkSent: 'Check your email for a reset link.',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password',
      passwordMismatch: 'Passwords do not match',
      passwordMinLength: 'Password must be at least 6 characters',
      updatePassword: 'Update Password',
      passwordResetFailed: 'Failed to reset password',
      passwordResetSuccess: 'Your password has been updated successfully',
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
      details: 'รายละเอียดคำสั่งซื้อ',
      pickupLocation: 'สถานที่รับสินค้า',
      pickupDay: 'วันที่รับสินค้า',
      total: 'รวมทั้งหมด',
      paymentReminder: 'กรุณานำเงินสดหรือเตรียมพร้อมเพย์เมื่อมารับสินค้า',
      backToHome: 'กลับสู่หน้าหลัก',
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
      signIn: 'เข้าสู่ระบบ',
      signUp: 'สมัครสมาชิก',
      createAccount: 'สร้างบัญชี',
      email: 'อีเมล',
      password: 'รหัสผ่าน',
      magicLink: 'ลิงก์มหัศจรรย์',
      sendMagicLink: 'ส่งลิงก์มหัศจรรย์',
      magicLinkSent: 'กรุณาตรวจสอบอีเมลของคุณสำหรับลิงก์มหัศจรรย์!',
      magicLinkInfo: 'เราจะส่งลิงก์ปลอดภัยให้คุณเพื่อเข้าสู่ระบบโดยไม่ต้องใช้รหัสผ่าน',
      noAccount: 'ยังไม่มีบัญชี?',
      haveAccount: 'มีบัญชีแล้ว?',
      loading: 'กำลังโหลด...',
      authError: 'การยืนยันตัวตนล้มเหลว',
      signOut: 'ออกจากระบบ',
      forgotPassword: 'ลืมรหัสผ่าน?',
      resetPassword: 'ตั้งรหัสผ่านใหม่',
      resetPasswordMessage: 'กรุณากรอกอีเมลของคุณเพื่อรับลิงก์ตั้งรหัสผ่านใหม่',
      sendResetLink: 'ส่งลิงก์รีเซ็ตรหัสผ่าน',
      resetLinkSent: 'กรุณาตรวจสอบอีเมลเพื่อรีเซ็ตรหัสผ่าน',
      newPassword: 'รหัสผ่านใหม่',
      confirmPassword: 'ยืนยันรหัสผ่าน',
      passwordMismatch: 'รหัสผ่านไม่ตรงกัน',
      passwordMinLength: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
      updatePassword: 'อัปเดตรหัสผ่าน',
      passwordResetFailed: 'ไม่สามารถรีเซ็ตรหัสผ่านได้',
      passwordResetSuccess: 'อัปเดตรหัสผ่านของคุณสำเร็จแล้ว',
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
  },
};
