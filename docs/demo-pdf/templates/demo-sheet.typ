#let primary = rgb("#003d9b")
#let muted = rgb("#64748b")
#let border = rgb("#dbe3f0")
#let surface = rgb("#f8fafc")

#let data = if "data" in sys.inputs {
  json(sys.inputs.at("data"))
} else {
  json("../kredensial.json")
}

#let sheet-type = data.at("sheet_type", default: "credentials")
#let footer-note = data.at("footer_note", default: "SkyHub Cargo Ops")

#set page(
  paper: "a4",
  margin: (x: 1.8cm, y: 1.6cm),
  footer: context [
    #line(length: 100%, stroke: 0.4pt + border)
    #grid(
      columns: (1fr, 1fr),
      text(size: 8pt, fill: muted)[#footer-note],
      align(right)[#text(size: 8pt, fill: muted)[#counter(page).display()]],
    )
  ],
)

#set text(font: ("Libertinus Serif", "Times New Roman"), size: 10pt)
#set par(justify: true, leading: 0.65em)

#align(center)[
  #text(size: 9pt, weight: "bold", fill: primary)[SKYHUB CARGO OPS]
  #v(0.35cm)
  #text(size: 20pt, weight: "bold", fill: primary)[#data.at("title", default: "Referensi Demo")]
  #v(0.2cm)
  #text(size: 11pt, fill: muted)[#data.at("subtitle", default: "")]
  #v(0.15cm)
  #text(size: 9pt, fill: muted)[#data.at("date", default: "")]
]

#v(0.55cm)

#if sheet-type == "credentials" [
  #block(fill: surface, inset: 12pt, radius: 6pt, stroke: 0.6pt + border)[
    #text(weight: "bold")[Kata sandi default:] #data.at("password_default", default: "operator123")
    #h(1em)
    #text(weight: "bold")[Base URL:] #data.at("base_url", default: "http://localhost:3100")
  ]

  #v(0.45cm)
  = Akun Login
  #table(
    columns: (2.1fr, 1.4fr, 1fr, 1fr, 0.7fr, 1.4fr),
    inset: 7pt,
    stroke: 0.4pt + border,
    fill: (_, row) => if row == 0 { primary.lighten(88%) } else { white },
    table.header(
      [*Nama*], [*Email*], [*Password*], [*Peran*], [*Stasiun*], [*Catatan*],
    ),
    ..for account in data.at("accounts", default: ()) {
      (
        account.at("name", default: ""),
        account.at("email", default: ""),
        account.at("password", default: ""),
        account.at("role_label", default: ""),
        account.at("station", default: ""),
        account.at("note", default: ""),
      )
    },
  )

  #v(0.35cm)
  = URL Penting
  #for item in data.at("urls", default: ()) [
    - #item.at("label", default: ""): #data.at("base_url", default: "")#item.at("path", default: "")
  ]

  #v(0.25cm)
  = Blok Cepat
  #for block in data.at("quick_blocks", default: ()) [
    *#block.at("label", default: "")*
    #for line in block.at("lines", default: ()) [
      #line
    ]
    #v(0.15cm)
  ]

  #v(0.15cm)
  = Skenario Presentasi
  #for scenario in data.at("scenarios", default: ()) [
    - #scenario
  ]

  #v(0.15cm)
  = Cheat Sheet
  #for line in data.at("cheat_sheet", default: ()) [
    - #line
  ]
]

#if sheet-type == "awb" [
  = Daftar AWB (#data.at("rows", default: ()).len() entri)
  #table(
    columns: (1.3fr, 1fr, 1fr, 1fr, 0.9fr),
    inset: 7pt,
    stroke: 0.4pt + border,
    fill: (x, y) => {
      if y == 0 { primary.lighten(88%) }
      else {
        let row-index = y - 1
        let rows = data.at("rows", default: ())
        if row-index < rows.len() and rows.at(row-index).at("highlight", default: false) {
          rgb("#fff7db")
        } else {
          white
        }
      }
    },
    table.header([*AWB*], [*Status*], [*Rute*], [*Penerbangan*], [*Catatan*]),
    ..for row in data.at("rows", default: ()) {
      (
        row.at("awb", default: ""),
        row.at("status_label", default: ""),
        row.at("route", default: ""),
        row.at("flight_number", default: ""),
        row.at("note", default: ""),
      )
    },
  )
]

#if sheet-type == "flights" [
  = Daftar Penerbangan (#data.at("rows", default: ()).len() entri)
  #table(
    columns: (1fr, 1.2fr, 1fr, 0.9fr, 0.5fr, 0.7fr, 0.7fr, 0.7fr),
    inset: 6pt,
    stroke: 0.4pt + border,
    fill: (_, row) => if row == 0 { primary.lighten(88%) } else { white },
    table.header(
      [*No. Penerbangan*], [*Maskapai*], [*Rute*], [*Status*], [*Gate*], [*Hari*], [*Cutoff*], [*Berangkat*],
    ),
    ..for row in data.at("rows", default: ()) {
      (
        row.at("flight_number", default: ""),
        row.at("airline", default: ""),
        row.at("route", default: ""),
        row.at("status_label", default: ""),
        row.at("gate", default: ""),
        row.at("day_label", default: ""),
        row.at("cutoff_time", default: ""),
        row.at("departure_time", default: ""),
      )
    },
  )
]