# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-suite.spec.ts >> Pricing: Three tiers visible
- Location: e2e/full-suite.spec.ts:106:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button:has-text("Start")').or(locator('text=Free'))
Expected: visible
Error: strict mode violation: locator('button:has-text("Start")').or(locator('text=Free')) resolved to 8 elements:
    1) <p code-path="src/pages/Pricing.tsx:54:9" class="pricing-hero-sub text-body-lg text-[#6B6B6B] max-w-[560px] mx-auto mb-10">Start free. Scale as your testing needs grow. Eve…</p> aka getByText('Start free. Scale as your')
    2) <h3 code-path="src/pages/Pricing.tsx:259:19" class="font-heading font-semibold text-2xl text-[#333333]">Free</h3> aka getByRole('heading', { name: 'Free' })
    3) <button code-path="src/pages/Pricing.tsx:311:15" class="w-full py-3 rounded-lg font-body font-medium text-base mb-6 transition-all duration-200 bg-[#12101A] text-white hover:bg-[#333333] hover:scale-[1.02]">Start Testing Free</button> aka getByRole('button', { name: 'Start Testing Free' })
    4) <span code-path="src/pages/Pricing.tsx:335:23" class="text-body-sm font-medium mt-0.5 text-[#574a7d]">Everything in Free, plus:</span> aka getByText('Everything in Free, plus:')
    5) <button code-path="src/pages/Pricing.tsx:311:15" class="w-full py-3 rounded-lg font-body font-medium text-base mb-6 transition-all duration-200 bg-[#574a7d] text-white hover:bg-[#4a3d6b] hover:scale-[1.02] active:scale-[0.98]">Get Started</button> aka getByRole('button', { name: 'Get Started', exact: true })
    6) <th code-path="src/pages/Pricing.tsx:476:17" class="text-center px-4 py-4 font-semibold text-sm text-[#333333]">Free</th> aka getByRole('columnheader', { name: 'Free' })
    7) <span code-path="src/pages/Pricing.tsx:575:19" class="font-medium text-base text-[#333333] pr-4">What's included in the Free plan?</span> aka getByRole('button', { name: 'What\'s included in the Free' })
    8) <button code-path="src/pages/Pricing.tsx:621:11" class="px-7 py-[14px] rounded-lg bg-white text-[#574a7d] font-body font-medium text-base hover:bg-[#F7F7FB] hover:scale-[1.02] transition-all duration-200 flex items-center gap-2 group">…</button> aka getByRole('button', { name: 'Get Started Free' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button:has-text("Start")').or(locator('text=Free'))

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - generic [ref=e5]:
      - link "TestForge" [ref=e6] [cursor=pointer]:
        - /url: "#/"
        - img [ref=e7]
        - generic [ref=e14]: TestForge
      - generic [ref=e15]:
        - link "Managed" [ref=e17] [cursor=pointer]:
          - /url: "#/managed"
          - text: Managed
        - link "Pipeline" [ref=e19] [cursor=pointer]:
          - /url: "#/pipeline"
          - text: Pipeline
        - link "Integrator" [ref=e21] [cursor=pointer]:
          - /url: "#/integrator"
          - text: Integrator
        - link "Testing" [ref=e23] [cursor=pointer]:
          - /url: "#/testing-dimensions"
          - text: Testing
        - link "Dashboard" [ref=e25] [cursor=pointer]:
          - /url: "#/dashboard"
          - text: Dashboard
        - link "Pricing" [ref=e27] [cursor=pointer]:
          - /url: "#/pricing"
          - text: Pricing
      - generic [ref=e28]:
        - link "Sign In" [ref=e30] [cursor=pointer]:
          - /url: "#/auth"
        - link "Get Started" [ref=e32] [cursor=pointer]:
          - /url: "#/auth?tab=signup"
          - text: Get Started
          - img [ref=e33]
  - main [ref=e35]:
    - generic [ref=e37]:
      - generic [ref=e39]:
        - paragraph [ref=e40]: // PRICING
        - heading "Simple pricing, serious testing." [level=1] [ref=e41]
        - paragraph [ref=e42]: Start free. Scale as your testing needs grow. Every plan includes access to the multi-dimensional pipeline — because partial testing is broken testing.
      - generic [ref=e44]:
        - generic [ref=e46]:
          - button "Monthly" [ref=e47] [cursor=pointer]
          - button "Yearly 30% savings" [ref=e48] [cursor=pointer]:
            - text: Yearly
            - generic [ref=e49]: 30% savings
        - generic [ref=e50]:
          - generic [ref=e51]:
            - generic [ref=e52]:
              - generic [ref=e53]:
                - img [ref=e54]
                - heading "Free" [level=3] [ref=e57]
              - generic [ref=e59]:
                - generic [ref=e60]: $0
                - generic [ref=e61]: /month
              - paragraph [ref=e62]: For individual developers exploring AI-powered testing.
            - button "Start Testing Free" [ref=e63] [cursor=pointer]
            - list [ref=e64]:
              - listitem [ref=e65]:
                - img [ref=e66]
                - generic [ref=e68]: All 21 testing dimensions
              - listitem [ref=e69]:
                - img [ref=e70]
                - generic [ref=e72]: 5 test runs/month
              - listitem [ref=e73]:
                - img [ref=e74]
                - generic [ref=e76]: 1 repository
              - listitem [ref=e77]:
                - img [ref=e78]
                - generic [ref=e80]: Basic reports (JSON/Markdown)
              - listitem [ref=e81]:
                - img [ref=e82]
                - generic [ref=e84]: Community support
              - listitem [ref=e85]:
                - img [ref=e86]
                - generic [ref=e88]: Public repos only
              - listitem [ref=e89]:
                - img [ref=e90]
                - generic [ref=e92]: MCP IDE integration
          - generic [ref=e93]:
            - generic [ref=e94]: Most Popular
            - generic [ref=e95]:
              - generic [ref=e96]:
                - img [ref=e97]
                - heading "Pro" [level=3] [ref=e99]
              - generic [ref=e101]:
                - generic [ref=e102]: $29
                - generic [ref=e103]: /month
              - paragraph [ref=e104]: $19/month billed yearly
              - paragraph [ref=e105]: For growing teams with active CI/CD pipelines.
            - button "Upgrade to Pro" [ref=e106] [cursor=pointer]
            - list [ref=e107]:
              - listitem [ref=e108]:
                - generic [ref=e109]: "Everything in Free, plus:"
              - listitem [ref=e110]:
                - img [ref=e111]
                - generic [ref=e113]: 100 test runs/month
              - listitem [ref=e114]:
                - img [ref=e115]
                - generic [ref=e117]: 10 repositories
              - listitem [ref=e118]:
                - img [ref=e119]
                - generic [ref=e121]: Private repo support
              - listitem [ref=e122]:
                - img [ref=e123]
                - generic [ref=e125]: Full 21-dimension reports
              - listitem [ref=e126]:
                - img [ref=e127]
                - generic [ref=e129]: Priority email support
              - listitem [ref=e130]:
                - img [ref=e131]
                - generic [ref=e133]: CI/CD webhook integration
              - listitem [ref=e134]:
                - img [ref=e135]
                - generic [ref=e137]: Slack/Discord notifications
              - listitem [ref=e138]:
                - img [ref=e139]
                - generic [ref=e141]: README badge generator
          - generic [ref=e142]:
            - generic [ref=e143]: Recommended
            - generic [ref=e144]:
              - generic [ref=e145]:
                - img [ref=e146]
                - heading "Pro" [level=3] [ref=e148]
              - generic [ref=e150]:
                - generic [ref=e151]: $99
                - generic [ref=e152]: /month
              - paragraph [ref=e153]: $69/month billed yearly
              - paragraph [ref=e154]: For engineering teams shipping production code.
            - button "Get Started" [ref=e155] [cursor=pointer]
            - list [ref=e156]:
              - listitem [ref=e157]:
                - generic [ref=e158]: "Everything in Starter, plus:"
              - listitem [ref=e159]:
                - img [ref=e160]
                - generic [ref=e162]: Unlimited test runs
              - listitem [ref=e163]:
                - img [ref=e164]
                - generic [ref=e166]: 10 repositories
              - listitem [ref=e167]:
                - img [ref=e168]
                - generic [ref=e170]: The Integrator — full intelligence
              - listitem [ref=e171]:
                - img [ref=e172]
                - generic [ref=e174]: Predictive models & dashboard
              - listitem [ref=e175]:
                - img [ref=e176]
                - generic [ref=e178]: Advanced security testing
              - listitem [ref=e179]:
                - img [ref=e180]
                - generic [ref=e182]: Visual regression testing
              - listitem [ref=e183]:
                - img [ref=e184]
                - generic [ref=e186]: Accessibility testing
              - listitem [ref=e187]:
                - img [ref=e188]
                - generic [ref=e190]: Team collaboration (up to 10)
          - generic [ref=e191]:
            - generic [ref=e192]:
              - generic [ref=e193]:
                - img [ref=e194]
                - heading "Enterprise" [level=3] [ref=e198]
              - generic [ref=e200]:
                - generic [ref=e201]: $199
                - generic [ref=e202]: /month
              - paragraph [ref=e203]: $149/month billed yearly
              - paragraph [ref=e204]: For organizations with complex testing requirements.
            - button "Contact Sales" [ref=e205] [cursor=pointer]
            - list [ref=e206]:
              - listitem [ref=e207]:
                - generic [ref=e208]: "Everything in Standard, plus:"
              - listitem [ref=e209]:
                - img [ref=e210]
                - generic [ref=e212]: Unlimited everything
              - listitem [ref=e213]:
                - img [ref=e214]
                - generic [ref=e216]: Custom AI model training
              - listitem [ref=e217]:
                - img [ref=e218]
                - generic [ref=e220]: On-premise deployment
              - listitem [ref=e221]:
                - img [ref=e222]
                - generic [ref=e224]: SSO & SAML authentication
              - listitem [ref=e225]:
                - img [ref=e226]
                - generic [ref=e228]: API access
              - listitem [ref=e229]:
                - img [ref=e230]
                - generic [ref=e232]: Dedicated account manager
              - listitem [ref=e233]:
                - img [ref=e234]
                - generic [ref=e236]: 24/7 phone support
              - listitem [ref=e237]:
                - img [ref=e238]
                - generic [ref=e240]: SLA guarantees
      - generic [ref=e242]:
        - paragraph [ref=e243]: // FULL COMPARISON
        - heading "Compare every feature." [level=2] [ref=e244]
        - table [ref=e246]:
          - rowgroup [ref=e247]:
            - row "Feature Free Starter Standard Enterprise" [ref=e248]:
              - columnheader "Feature" [ref=e249]
              - columnheader "Free" [ref=e250]
              - columnheader "Starter" [ref=e251]
              - columnheader "Standard" [ref=e252]
              - columnheader "Enterprise" [ref=e253]
          - rowgroup [ref=e254]:
            - row "Testing Pipeline" [ref=e255]:
              - cell "Testing Pipeline" [ref=e256]
            - row "Test runs/month 50 500 Unlimited Unlimited" [ref=e257]:
              - cell "Test runs/month" [ref=e258]
              - cell "50" [ref=e259]
              - cell "500" [ref=e260]
              - cell "Unlimited" [ref=e261]
              - cell "Unlimited" [ref=e262]
            - row "Testing dimensions" [ref=e263]:
              - cell "Testing dimensions" [ref=e264]
              - cell [ref=e265]:
                - img [ref=e266]
              - cell [ref=e268]:
                - img [ref=e269]
              - cell [ref=e271]:
                - img [ref=e272]
              - cell [ref=e274]:
                - img [ref=e275]
            - row "Repositories 1 3 10 Unlimited" [ref=e277]:
              - cell "Repositories" [ref=e278]
              - cell "1" [ref=e279]
              - cell "3" [ref=e280]
              - cell "10" [ref=e281]
              - cell "Unlimited" [ref=e282]
            - row "The Integrator" [ref=e283]:
              - cell "The Integrator" [ref=e284]
            - row "Basic recommendations" [ref=e285]:
              - cell "Basic recommendations" [ref=e286]
              - cell [ref=e287]:
                - img [ref=e288]
              - cell [ref=e289]:
                - img [ref=e290]
              - cell [ref=e292]:
                - img [ref=e293]
              - cell [ref=e295]:
                - img [ref=e296]
            - row "Full intelligence" [ref=e298]:
              - cell "Full intelligence" [ref=e299]
              - cell [ref=e300]:
                - img [ref=e301]
              - cell [ref=e302]:
                - img [ref=e303]
              - cell [ref=e304]:
                - img [ref=e305]
              - cell [ref=e307]:
                - img [ref=e308]
            - row "Custom rules" [ref=e310]:
              - cell "Custom rules" [ref=e311]
              - cell [ref=e312]:
                - img [ref=e313]
              - cell [ref=e314]:
                - img [ref=e315]
              - cell [ref=e316]:
                - img [ref=e317]
              - cell [ref=e318]:
                - img [ref=e319]
            - row "PRD Generator" [ref=e321]:
              - cell "PRD Generator" [ref=e322]
            - row "PRDs/month 5 Unlimited Unlimited Unlimited" [ref=e323]:
              - cell "PRDs/month" [ref=e324]
              - cell "5" [ref=e325]
              - cell "Unlimited" [ref=e326]
              - cell "Unlimited" [ref=e327]
              - cell "Unlimited" [ref=e328]
            - row "Severity classification Basic Full Full Full" [ref=e329]:
              - cell "Severity classification" [ref=e330]
              - cell "Basic" [ref=e331]
              - cell "Full" [ref=e332]
              - cell "Full" [ref=e333]
              - cell "Full" [ref=e334]
            - row "Migration paths" [ref=e335]:
              - cell "Migration paths" [ref=e336]
              - cell [ref=e337]:
                - img [ref=e338]
              - cell [ref=e339]:
                - img [ref=e340]
              - cell [ref=e342]:
                - img [ref=e343]
              - cell [ref=e345]:
                - img [ref=e346]
            - row "Analytics" [ref=e348]:
              - cell "Analytics" [ref=e349]
            - row "Dashboard" [ref=e350]:
              - cell "Dashboard" [ref=e351]
              - cell [ref=e352]:
                - img [ref=e353]
              - cell [ref=e354]:
                - img [ref=e355]
              - cell [ref=e356]:
                - img [ref=e357]
              - cell [ref=e359]:
                - img [ref=e360]
            - row "Predictive models" [ref=e362]:
              - cell "Predictive models" [ref=e363]
              - cell [ref=e364]:
                - img [ref=e365]
              - cell [ref=e366]:
                - img [ref=e367]
              - cell [ref=e368]:
                - img [ref=e369]
              - cell [ref=e371]:
                - img [ref=e372]
            - row "Historical data 7 days 30 days 90 days Unlimited" [ref=e374]:
              - cell "Historical data" [ref=e375]
              - cell "7 days" [ref=e376]
              - cell "30 days" [ref=e377]
              - cell "90 days" [ref=e378]
              - cell "Unlimited" [ref=e379]
            - row "Security" [ref=e380]:
              - cell "Security" [ref=e381]
            - row "SAST" [ref=e382]:
              - cell "SAST" [ref=e383]
              - cell [ref=e384]:
                - img [ref=e385]
              - cell [ref=e387]:
                - img [ref=e388]
              - cell [ref=e390]:
                - img [ref=e391]
              - cell [ref=e393]:
                - img [ref=e394]
            - row "DAST" [ref=e396]:
              - cell "DAST" [ref=e397]
              - cell [ref=e398]:
                - img [ref=e399]
              - cell [ref=e400]:
                - img [ref=e401]
              - cell [ref=e402]:
                - img [ref=e403]
              - cell [ref=e405]:
                - img [ref=e406]
            - row "AI fuzzing" [ref=e408]:
              - cell "AI fuzzing" [ref=e409]
              - cell [ref=e410]:
                - img [ref=e411]
              - cell [ref=e412]:
                - img [ref=e413]
              - cell [ref=e414]:
                - img [ref=e415]
              - cell [ref=e417]:
                - img [ref=e418]
            - row "Secret detection" [ref=e420]:
              - cell "Secret detection" [ref=e421]
              - cell [ref=e422]:
                - img [ref=e423]
              - cell [ref=e425]:
                - img [ref=e426]
              - cell [ref=e428]:
                - img [ref=e429]
              - cell [ref=e431]:
                - img [ref=e432]
            - row "Visual & A11y" [ref=e434]:
              - cell "Visual & A11y" [ref=e435]
            - row "Visual regression" [ref=e436]:
              - cell "Visual regression" [ref=e437]
              - cell [ref=e438]:
                - img [ref=e439]
              - cell [ref=e440]:
                - img [ref=e441]
              - cell [ref=e442]:
                - img [ref=e443]
              - cell [ref=e445]:
                - img [ref=e446]
            - row "Accessibility testing" [ref=e448]:
              - cell "Accessibility testing" [ref=e449]
              - cell [ref=e450]:
                - img [ref=e451]
              - cell [ref=e452]:
                - img [ref=e453]
              - cell [ref=e454]:
                - img [ref=e455]
              - cell [ref=e457]:
                - img [ref=e458]
            - row "Platform" [ref=e460]:
              - cell "Platform" [ref=e461]
            - row "Data retention 7 days 30 days 90 days Unlimited" [ref=e462]:
              - cell "Data retention" [ref=e463]
              - cell "7 days" [ref=e464]
              - cell "30 days" [ref=e465]
              - cell "90 days" [ref=e466]
              - cell "Unlimited" [ref=e467]
            - row "Team members 1 3 10 Unlimited" [ref=e468]:
              - cell "Team members" [ref=e469]
              - cell "1" [ref=e470]
              - cell "3" [ref=e471]
              - cell "10" [ref=e472]
              - cell "Unlimited" [ref=e473]
            - row "API access" [ref=e474]:
              - cell "API access" [ref=e475]
              - cell [ref=e476]:
                - img [ref=e477]
              - cell [ref=e478]:
                - img [ref=e479]
              - cell [ref=e480]:
                - img [ref=e481]
              - cell [ref=e482]:
                - img [ref=e483]
            - row "SSO/SAML" [ref=e485]:
              - cell "SSO/SAML" [ref=e486]
              - cell [ref=e487]:
                - img [ref=e488]
              - cell [ref=e489]:
                - img [ref=e490]
              - cell [ref=e491]:
                - img [ref=e492]
              - cell [ref=e493]:
                - img [ref=e494]
            - row "Support" [ref=e496]:
              - cell "Support" [ref=e497]
            - row "Community" [ref=e498]:
              - cell "Community" [ref=e499]
              - cell [ref=e500]:
                - img [ref=e501]
              - cell [ref=e503]:
                - img [ref=e504]
              - cell [ref=e506]:
                - img [ref=e507]
              - cell [ref=e509]:
                - img [ref=e510]
            - row "Email support" [ref=e512]:
              - cell "Email support" [ref=e513]
              - cell [ref=e514]:
                - img [ref=e515]
              - cell [ref=e516]:
                - img [ref=e517]
              - cell [ref=e519]:
                - img [ref=e520]
              - cell [ref=e522]:
                - img [ref=e523]
            - row "Dedicated support" [ref=e525]:
              - cell "Dedicated support" [ref=e526]
              - cell [ref=e527]:
                - img [ref=e528]
              - cell [ref=e529]:
                - img [ref=e530]
              - cell [ref=e531]:
                - img [ref=e532]
              - cell [ref=e534]:
                - img [ref=e535]
            - row "24/7 phone" [ref=e537]:
              - cell "24/7 phone" [ref=e538]
              - cell [ref=e539]:
                - img [ref=e540]
              - cell [ref=e541]:
                - img [ref=e542]
              - cell [ref=e543]:
                - img [ref=e544]
              - cell [ref=e545]:
                - img [ref=e546]
      - generic [ref=e550]:
        - paragraph [ref=e551]: // FAQ
        - heading "Questions? Answers." [level=2] [ref=e552]
        - generic [ref=e553]:
          - button "What's included in the Free plan?" [ref=e555] [cursor=pointer]:
            - generic [ref=e556]: What's included in the Free plan?
            - img [ref=e558]
          - button "How does The Integrator work?" [ref=e561] [cursor=pointer]:
            - generic [ref=e562]: How does The Integrator work?
            - img [ref=e564]
          - button "Can I switch plans anytime?" [ref=e567] [cursor=pointer]:
            - generic [ref=e568]: Can I switch plans anytime?
            - img [ref=e570]
          - button "What happens when I exceed my test run limit?" [ref=e573] [cursor=pointer]:
            - generic [ref=e574]: What happens when I exceed my test run limit?
            - img [ref=e576]
          - button "Is there an enterprise trial?" [ref=e579] [cursor=pointer]:
            - generic [ref=e580]: Is there an enterprise trial?
            - img [ref=e582]
          - button "What integrations are supported?" [ref=e585] [cursor=pointer]:
            - generic [ref=e586]: What integrations are supported?
            - img [ref=e588]
          - button "How is my data secured?" [ref=e591] [cursor=pointer]:
            - generic [ref=e592]: How is my data secured?
            - img [ref=e594]
      - generic [ref=e597]:
        - heading "Ready to test without limits?" [level=2] [ref=e598]
        - paragraph [ref=e599]: Join 100,000+ developers who ship with confidence.
        - generic [ref=e600]:
          - button "Get Started Free" [ref=e601] [cursor=pointer]:
            - text: Get Started Free
            - img [ref=e602]
          - button "Contact Sales" [ref=e604] [cursor=pointer]
  - contentinfo [ref=e605]:
    - generic [ref=e606]:
      - generic [ref=e607]:
        - generic [ref=e608]:
          - generic [ref=e609]:
            - img [ref=e610]
            - generic [ref=e617]: TestForge
          - paragraph [ref=e618]: Privacy-first autonomous testing. Harden your codebase, ship with certainty.
          - generic [ref=e619]:
            - link [ref=e620] [cursor=pointer]:
              - /url: https://github.com/t4tarzan/testforge
              - img [ref=e621]
            - link [ref=e624] [cursor=pointer]:
              - /url: "#"
              - img [ref=e625]
            - link [ref=e627] [cursor=pointer]:
              - /url: "#"
              - img [ref=e628]
            - link [ref=e632] [cursor=pointer]:
              - /url: "#"
              - img [ref=e633]
        - generic [ref=e635]:
          - heading "Product" [level=4] [ref=e636]
          - list [ref=e637]:
            - listitem [ref=e638]:
              - link "Managed" [ref=e639] [cursor=pointer]:
                - /url: "#/managed"
            - listitem [ref=e640]:
              - link "MCP Integration" [ref=e641] [cursor=pointer]:
                - /url: "#/mcp"
            - listitem [ref=e642]:
              - link "Pipeline" [ref=e643] [cursor=pointer]:
                - /url: "#/pipeline"
            - listitem [ref=e644]:
              - link "The Integrator" [ref=e645] [cursor=pointer]:
                - /url: "#/integrator"
            - listitem [ref=e646]:
              - link "Dashboard" [ref=e647] [cursor=pointer]:
                - /url: "#/dashboard"
            - listitem [ref=e648]:
              - link "Pricing" [ref=e649] [cursor=pointer]:
                - /url: "#/pricing"
        - generic [ref=e650]:
          - heading "Resources" [level=4] [ref=e651]
          - list [ref=e652]:
            - listitem [ref=e653]:
              - link "Documentation" [ref=e654] [cursor=pointer]:
                - /url: "#/docs"
            - listitem [ref=e655]:
              - link "API Reference" [ref=e656] [cursor=pointer]:
                - /url: "#/docs"
            - listitem [ref=e657]:
              - link "Test Runner" [ref=e658] [cursor=pointer]:
                - /url: "#/run-test"
            - listitem [ref=e659]:
              - link "PRD Generator" [ref=e660] [cursor=pointer]:
                - /url: "#/prd-generator"
            - listitem [ref=e661]:
              - link "Testing Dimensions" [ref=e662] [cursor=pointer]:
                - /url: "#/testing-dimensions"
        - generic [ref=e663]:
          - heading "Company" [level=4] [ref=e664]
          - list [ref=e665]:
            - listitem [ref=e666]:
              - link "GitHub" [ref=e667] [cursor=pointer]:
                - /url: https://github.com/t4tarzan/testforge
            - listitem [ref=e668]:
              - link "Fly.io MCP" [ref=e669] [cursor=pointer]:
                - /url: https://testforge-mcp.fly.dev
            - listitem [ref=e670]:
              - link "Contact" [ref=e671] [cursor=pointer]:
                - /url: https://github.com/t4tarzan/testforge/issues
            - listitem [ref=e672]:
              - link "Changelog" [ref=e673] [cursor=pointer]:
                - /url: /docs
            - listitem [ref=e674]:
              - link "Status" [ref=e675] [cursor=pointer]:
                - /url: https://testforge-mcp.fly.dev/health
      - generic [ref=e676]:
        - paragraph [ref=e677]: 2026 TestForge. All rights reserved.
        - generic [ref=e680]: All Systems Operational
```

# Test source

```ts
  8   | const pages = [
  9   |   { name: 'Home', path: '/' },
  10  |   { name: 'Managed', path: '/#/managed' },
  11  |   { name: 'Pipeline', path: '/#/pipeline' },
  12  |   { name: 'Integrator', path: '/#/integrator' },
  13  |   { name: 'Testing Dimensions', path: '/#/testing-dimensions' },
  14  |   { name: 'PRD Generator', path: '/#/prd-generator' },
  15  |   { name: 'Dashboard', path: '/#/dashboard' },
  16  |   { name: 'Pricing', path: '/#/pricing' },
  17  |   { name: 'Auth', path: '/#/auth' },
  18  |   { name: 'MCP Integration', path: '/#/mcp' },
  19  |   { name: 'Docs', path: '/#/docs' },
  20  |   { name: 'Test Runner', path: '/#/run-test' },
  21  | ];
  22  | 
  23  | for (const page of pages) {
  24  |   test(`Page renders: ${page.name}`, async ({ page: p }) => {
  25  |     const res = await p.goto(`${BASE}${page.path}`, { waitUntil: 'networkidle' });
  26  |     expect(res?.status()).toBe(200);
  27  |     // Verify navbar is present
  28  |     await expect(p.locator('nav, header, [class*="navbar"]').first()).toBeVisible({ timeout: 5000 });
  29  |     // Verify page has content (not blank)
  30  |     const bodyText = await p.locator('body').innerText();
  31  |     expect(bodyText.length).toBeGreaterThan(100);
  32  |   });
  33  | }
  34  | 
  35  | // ═══════════════════════════════════════════════════
  36  | // API ENDPOINTS — All return data
  37  | // ═══════════════════════════════════════════════════
  38  | test('API: Health check', async ({ request }) => {
  39  |   const res = await request.get(`${BASE}/api/health`);
  40  |   expect(res.status()).toBe(200);
  41  |   const data = await res.json();
  42  |   expect(data.status).toBe('ok');
  43  | });
  44  | 
  45  | test('API: Stripe plans', async ({ request }) => {
  46  |   const res = await request.get(`${BASE}/api/stripe`);
  47  |   expect(res.status()).toBe(200);
  48  |   const data = await res.json();
  49  |   expect(data.plans.length).toBeGreaterThanOrEqual(3);
  50  | });
  51  | 
  52  | test('API: Badge SVG', async ({ request }) => {
  53  |   const res = await request.get(`${BASE}/api/badge?score=85`);
  54  |   expect(res.status()).toBe(200);
  55  |   const contentType = res.headers()['content-type'];
  56  |   expect(contentType).toContain('svg');
  57  | });
  58  | 
  59  | test('API: Status page', async ({ request }) => {
  60  |   const res = await request.get(`${BASE}/api/status`);
  61  |   expect(res.status()).toBe(200);
  62  | });
  63  | 
  64  | test('API: History', async ({ request }) => {
  65  |   const res = await request.get(`${BASE}/api/history`);
  66  |   expect(res.status()).toBe(200);
  67  | });
  68  | 
  69  | // ═══════════════════════════════════════════════════
  70  | // AUTH FLOW — Login page works
  71  | // ═══════════════════════════════════════════════════
  72  | test('Auth: Login page renders', async ({ page }) => {
  73  |   await page.goto(`${BASE}/#/auth`, { waitUntil: 'networkidle' });
  74  |   // Should have GitHub button
  75  |   await expect(page.locator('text=Continue with GitHub')).toBeVisible({ timeout: 5000 });
  76  |   // Should have email login form
  77  |   await expect(page.locator('input[type="email"], input[placeholder*="email"]').first()).toBeVisible();
  78  | });
  79  | 
  80  | test('Auth: GitHub OAuth redirects', async ({ page }) => {
  81  |   const res = await page.goto(`${BASE}/api/auth/callback`);
  82  |   // Should redirect to GitHub (302)
  83  |   expect([301,302,303].includes(res?.status() || 0)).toBeTruthy();
  84  |   expect(res?.headers()['location']).toContain('github.com');
  85  | });
  86  | 
  87  | // ═══════════════════════════════════════════════════
  88  | // MANAGED PAGE — Can submit a repo
  89  | // ═══════════════════════════════════════════════════
  90  | test('Managed: Input accepts repo URL', async ({ page }) => {
  91  |   await page.goto(`${BASE}/#/managed`, { waitUntil: 'networkidle' });
  92  |   const input = page.locator('input[placeholder*="github.com"]');
  93  |   await expect(input).toBeVisible({ timeout: 5000 });
  94  |   await input.fill('https://github.com/tinyhttp/malibu');
  95  |   expect(await input.inputValue()).toBe('https://github.com/tinyhttp/malibu');
  96  | });
  97  | 
  98  | test('Managed: Run Analysis button exists', async ({ page }) => {
  99  |   await page.goto(`${BASE}/#/managed`, { waitUntil: 'networkidle' });
  100 |   await expect(page.locator('button:has-text("Run Analysis")')).toBeVisible({ timeout: 5000 });
  101 | });
  102 | 
  103 | // ═══════════════════════════════════════════════════
  104 | // PRICING — Plans and CTAs
  105 | // ═══════════════════════════════════════════════════
  106 | test('Pricing: Three tiers visible', async ({ page }) => {
  107 |   await page.goto(`${BASE}/#/pricing`, { waitUntil: 'networkidle' });
> 108 |   await expect(page.locator('button:has-text("Start")').or(page.locator('text=Free'))).toBeVisible({ timeout: 5000 });
      |                                                                                        ^ Error: expect(locator).toBeVisible() failed
  109 | });
  110 | 
  111 | test('Pricing: Free CTA links to managed', async ({ page }) => {
  112 |   await page.goto(`${BASE}/#/pricing`, { waitUntil: 'networkidle' });
  113 |   const freeBtn = page.locator('button:has-text("Start Testing Free")');
  114 |   if (await freeBtn.isVisible()) {
  115 |     await freeBtn.click();
  116 |     await page.waitForURL('**/managed**', { timeout: 5000 });
  117 |     expect(page.url()).toContain('managed');
  118 |   }
  119 | });
  120 | 
  121 | // ═══════════════════════════════════════════════════
  122 | // DASHBOARD — Shows data
  123 | // ═══════════════════════════════════════════════════
  124 | test('Dashboard: Loads with content', async ({ page }) => {
  125 |   await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle' });
  126 |   await expect(page.locator('text=ANALYTICS').or(page.locator('text=analytics'))).toBeVisible({ timeout: 5000 });
  127 | });
  128 | 
  129 | // ═══════════════════════════════════════════════════
  130 | // DOCS — Navigation works
  131 | // ═══════════════════════════════════════════════════
  132 | test('Docs: Sidebar navigation visible', async ({ page }) => {
  133 |   await page.goto(`${BASE}/#/docs`, { waitUntil: 'networkidle' });
  134 |   await expect(page.locator('text=GETTING STARTED').or(page.locator('text=Getting Started'))).toBeVisible({ timeout: 5000 });
  135 | });
  136 | 
  137 | test('Docs: API Reference shows endpoints', async ({ page }) => {
  138 |   await page.goto(`${BASE}/#/docs`, { waitUntil: 'networkidle' });
  139 |   // Click API Reference in sidebar
  140 |   const apiLink = page.locator('text=API Reference');
  141 |   if (await apiLink.isVisible()) {
  142 |     await apiLink.click();
  143 |     await page.waitForTimeout(500);
  144 |     const content = await page.locator('main, [class*="content"]').innerText();
  145 |     expect(content.toLowerCase()).toContain('api');
  146 |   }
  147 | });
  148 | 
  149 | // ═══════════════════════════════════════════════════
  150 | // FOOTER — All links present
  151 | // ═══════════════════════════════════════════════════
  152 | test('Footer: All links present', async ({ page }) => {
  153 |   await page.goto(BASE, { waitUntil: 'networkidle' });
  154 |   const footer = page.locator('footer');
  155 |   await footer.scrollIntoViewIfNeeded();
  156 |   const footerLinks = ['Managed', 'MCP', 'Pipeline', 'Dashboard', 'Pricing', 'Documentation', 'GitHub'];
  157 |   for (const link of footerLinks) {
  158 |     await expect(footer.locator(`text=${link}`).first()).toBeVisible({ timeout: 3000 });
  159 |   }
  160 | });
  161 | 
  162 | // ═══════════════════════════════════════════════════
  163 | // RESPONSIVE — Mobile viewport
  164 | // ═══════════════════════════════════════════════════
  165 | test('Mobile: Home page renders on phone', async ({ page }) => {
  166 |   await page.setViewportSize({ width: 375, height: 812 });
  167 |   await page.goto(BASE, { waitUntil: 'networkidle' });
  168 |   await expect(page.locator('nav, header, [class*="navbar"]').first()).toBeVisible({ timeout: 5000 });
  169 | });
  170 | 
  171 | test('Mobile: Managed page usable on phone', async ({ page }) => {
  172 |   await page.setViewportSize({ width: 375, height: 812 });
  173 |   await page.goto(`${BASE}/#/managed`, { waitUntil: 'networkidle' });
  174 |   const input = page.locator('input[placeholder*="github"]');
  175 |   await expect(input).toBeVisible({ timeout: 5000 });
  176 | });
  177 | 
  178 | // ═══════════════════════════════════════════════════
  179 | // PERFORMANCE — Load time checks
  180 | // ═══════════════════════════════════════════════════
  181 | test('Performance: Home loads under 5s', async ({ page }) => {
  182 |   const start = Date.now();
  183 |   await page.goto(BASE, { waitUntil: 'networkidle' });
  184 |   const loadTime = Date.now() - start;
  185 |   expect(loadTime).toBeLessThan(10000);
  186 | });
  187 | 
  188 | // ═══════════════════════════════════════════════════
  189 | // INTEGRATOR — Architecture section renders
  190 | // ═══════════════════════════════════════════════════
  191 | test('Integrator: 4 layers visible', async ({ page }) => {
  192 |   await page.goto(`${BASE}/#/integrator`, { waitUntil: 'networkidle' });
  193 |   const layers = page.locator('text=State Ingestion, text=Analysis Engine, text=Action Engine, text=Validation Layer');
  194 |   // At least the page loads
  195 |   await expect(page.locator('h1, h2').filter({ hasText: 'Integrator' }).first()).toBeVisible({ timeout: 5000 });
  196 | });
  197 | 
```