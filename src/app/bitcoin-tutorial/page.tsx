"use client";

import { useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";

const videos = [
  {
    id: 1,
    title: "Cash App Video Tutorial",
    videoUrl: "https://www.youtube.com/embed/HK57o2JQDeI",
    thumbnail: "https://img.youtube.com/vi/HK57o2JQDeI/maxresdefault.jpg",
  },
  {
    id: 2,
    title: "Venmo Video Tutorial",
    videoUrl: "https://www.youtube.com/embed/SWPhIUHvj0c",
    thumbnail: "https://img.youtube.com/vi/SWPhIUHvj0c/maxresdefault.jpg",
  },
  {
    id: 3,
    title: "PayPal Video Tutorial",
    videoUrl: "https://www.youtube.com/embed/BE1lNXd6x4w",
    thumbnail: "https://img.youtube.com/vi/BE1lNXd6x4w/maxresdefault.jpg",
  },
];

const section = "tile scroll-mt-28 space-y-3 text-sm leading-7 text-muted-foreground";

export default function BitcoinTutorialPage() {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const video = videos[currentVideoIndex];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
      <PageHeader
        kicker="Tools & Resources"
        title="Bitcoin Tutorial / How To Pay"
        lede="This tutorial covers everything you need to know about Bitcoin (BTC). From wallets, how to buy BTC, and how to pay. Click a section to jump straight to it."
      />
      <nav className={`${section} mb-6`}>
        <h2 className="text-lg text-foreground">Table of Contents</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><a className="text-signal" href="#section-1">Section 1: Understanding Wallets</a></li>
          <li><a className="text-signal" href="#section-2">Section 2: Getting Started</a></li>
          <li>
            <a className="text-signal" href="#section-3">Section 3: How to Pay with Bitcoin</a>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><a className="text-signal" href="#phone-computer">Phone with Computer</a></li>
              <li><a className="text-signal" href="#phone-only">Phone Only</a></li>
              <li><a className="text-signal" href="#computer-only">Computer Only</a></li>
            </ul>
          </li>
          <li><a className="text-signal" href="#section-4">Section 4: Video Tutorials</a></li>
        </ul>
      </nav>
      <div className="space-y-6">
        <section id="section-1" className={section}>
          <h2 className="text-lg text-foreground">Section 1: Understanding Wallets</h2>
          <h3 className="font-medium text-foreground">What is a Bitcoin Wallet?</h3>
          <p>
            A bitcoin wallet is a digital application that allows you to store, send, and receive bitcoin. Think of it
            like a digital bank account specifically for cryptocurrency. Your wallet contains a unique address (similar
            to an account number) that you&apos;ll use to receive bitcoin from others.
          </p>
          <h3 className="font-medium text-foreground">Our Recommended Wallets</h3>
          <p>For beginners, we recommend starting with one of these trusted and user-friendly options:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Cash App:</strong> The easiest option for most users. Simple interface, quick setup, and widely trusted.</li>
            <li><strong>Venmo:</strong> Great if you already use Venmo for payments. Seamless integration with your existing account.</li>
            <li><strong>PayPal:</strong> Familiar platform for millions of users. Easy to buy and hold bitcoin.</li>
          </ul>
          <p>
            These apps are beginner-friendly because they handle the complex technical aspects of bitcoin for you,
            allowing you to focus on simply buying and using your cryptocurrency.
          </p>
        </section>
        <section id="section-2" className={section}>
          <h2 className="text-lg text-foreground">Section 2: Getting Started</h2>
          <h3 className="font-medium text-foreground">Step 1: Register for an Account</h3>
          <p>Choose one of the recommended wallets above and download the app to your phone or visit their website. Create an account by providing:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your email address</li>
            <li>A secure password</li>
            <li>Your phone number for verification</li>
          </ul>
          <h3 className="font-medium text-foreground">Step 2: Verify Your Identity</h3>
          <p>Due to financial regulations, you&apos;ll need to verify your identity. This typically involves:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Uploading a photo of your government-issued ID (driver&apos;s license or passport)</li>
            <li>Taking a selfie for facial verification</li>
            <li>Providing your social security number (for US users)</li>
            <li>Confirming your address</li>
          </ul>
          <p>This process usually takes just a few minutes, though approval can take up to 24 hours in some cases.</p>
          <h3 className="font-medium text-foreground">Step 3: Buy Bitcoin</h3>
          <p>Once your account is verified:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Link your bank account, debit card, or credit card to your wallet</li>
            <li>Navigate to the Buy Bitcoin or Buy Crypto section</li>
            <li>Enter the amount you want to purchase</li>
            <li>Review the transaction details and fees</li>
            <li>Confirm your purchase</li>
          </ul>
          <p>Your bitcoin will appear in your wallet within minutes to a few hours, depending on the platform.</p>
        </section>
        <section id="section-3" className={section}>
          <h2 className="text-lg text-foreground">Section 3: How to Pay with Bitcoin</h2>
          <p>Paying with bitcoin involves scanning a QR code or copying a bitcoin address. Here&apos;s how to do it depending on your device setup:</p>
          <div id="phone-computer" className="space-y-2">
            <h3 className="font-medium text-foreground">Phone with Computer</h3>
            <p>This is the most common scenario when making a purchase online from your computer.</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>On your computer, proceed to checkout and select Pay with BTCPay</li>
              <li>A QR code with a bitcoin address will appear on your screen</li>
              <li>Open your bitcoin wallet app on your phone</li>
              <li>Tap Send, Pay, or the button with arrows up and down</li>
              <li>Tap the QR code scanner icon</li>
              <li>Point your phone&apos;s camera at the QR code on your computer screen</li>
              <li>The payment address will auto-fill</li>
              <li>Input payment amount, if not auto filled from the QR code</li>
              <li>Review the details and confirm the payment</li>
              <li>Wait for confirmation (increase your network fees to accelerate transaction speeds)</li>
            </ol>
            <p>Make sure the amount matches exactly. Bitcoin transactions cannot be reversed.</p>
          </div>
          <div id="phone-only" className="space-y-2">
            <h3 className="font-medium text-foreground">Phone Only</h3>
            <p>When you&apos;re shopping or making a payment entirely from your phone.</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>On your phone&apos;s browser, proceed to checkout and select Pay with BTCPay</li>
              <li>A bitcoin address and amount will be displayed</li>
              <li>Tap the overlapping squares to the right of the bitcoin address to copy it</li>
              <li>Switch to your bitcoin wallet app (don&apos;t close your browser)</li>
              <li>Tap Send or Pay</li>
              <li>Paste the bitcoin address into the recipient field</li>
              <li>Enter the payment amount shown at the top of the QR code</li>
              <li>Review the details carefully</li>
              <li>Confirm the payment</li>
              <li>Switch back to your browser to see the confirmation</li>
            </ol>
          </div>
          <div id="computer-only" className="space-y-2">
            <h3 className="font-medium text-foreground">Computer Only</h3>
            <p>When using bitcoin stored on your computer or when your phone isn&apos;t available.</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Navigate to checkout and select Pay with BTCPay</li>
              <li>A QR code and bitcoin address will be displayed</li>
              <li>Open your bitcoin wallet on your computer (or access it via web browser)</li>
              <li>Tap Send or Pay</li>
              <li>Copy the bitcoin address from the payment page and paste it into your wallet</li>
              <li>Enter the exact payment amount at the top of the QR code</li>
              <li>Review the transaction fee and total</li>
              <li>Confirm the payment</li>
              <li>Wait for the transaction confirmation on the payment page</li>
            </ol>
          </div>
        </section>
        <section id="section-4" className={section}>
          <h2 className="text-lg text-foreground">Section 4: Video Tutorials</h2>
          <p>Visual learners can follow the Cash App, Venmo, and PayPal guides.</p>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="overflow-hidden rounded-lg bg-black aspect-video lg:col-span-2">
              {isVideoPlaying ? (
                <iframe
                  src={`${video.videoUrl}?autoplay=1`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={video.title}
                />
              ) : (
                <button
                  type="button"
                  className="relative h-full w-full"
                  onClick={() => setIsVideoPlaying(true)}
                >
                  <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                    Play {video.title}
                  </span>
                </button>
              )}
            </div>
            <div className="space-y-2">
              {videos.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCurrentVideoIndex(index);
                    setIsVideoPlaying(false);
                  }}
                  className={`w-full rounded-lg border p-2 text-left text-sm ${
                    index === currentVideoIndex ? "border-signal" : "border-border/40"
                  }`}
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
