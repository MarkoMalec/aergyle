"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

export default function LevelingAdminPage() {
  const [xpTable, setXpTable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchXpTable();
  }, []);

  const fetchXpTable = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/leveling/table");
    const data = await response.json();
    setXpTable(data);
    setLoading(false);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="mb-8 text-4xl font-bold">Leveling System Admin</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>XP Table (Levels 1-70)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-800">
                  <tr>
                    <th className="p-2 text-left">Level</th>
                    <th className="p-2 text-right">XP Required</th>
                    <th className="p-2 text-right">Cumulative XP</th>
                    <th className="p-2 text-center">Bracket</th>
                  </tr>
                </thead>
                <tbody>
                  {xpTable.map((row) => (
                    <tr
                      key={row.level}
                      className={`
                        border-t border-gray-700
                        ${row.bracket === "Easy" && "bg-green-900/20"}
                        ${row.bracket === "Normal" && "bg-blue-900/20"}
                        ${row.bracket === "Hard" && "bg-yellow-900/20"}
                        ${row.bracket === "Very Hard" && "bg-orange-900/20"}
                        ${row.bracket === "Extreme" && "bg-red-900/20"}
                        ${row.bracket === "Soft Cap" && "bg-purple-900/40"}
                      `}
                    >
                      <td className="p-2 font-bold">{row.level}</td>
                      <td className="p-2 text-right font-mono">
                        {formatNumber(row.xpRequired)}
                      </td>
                      <td className="p-2 text-right font-mono text-gray-400">
                        {formatNumber(row.cumulativeXp)}
                      </td>
                      <td className="p-2 text-center">
                        <span
                          className={`
                          rounded px-2 py-1 text-xs font-semibold
                          ${row.bracket === "Easy" && "bg-green-600"}
                          ${row.bracket === "Normal" && "bg-blue-600"}
                          ${row.bracket === "Hard" && "bg-yellow-600"}
                          ${row.bracket === "Very Hard" && "bg-orange-600"}
                          ${row.bracket === "Extreme" && "bg-red-600"}
                          ${row.bracket === "Soft Cap" && "bg-purple-600"}
                        `}
                        >
                          {row.bracket}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuration Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="mb-2 font-semibold text-green-400">Easy (1-5)</h3>
              <p>80% of base XP requirement</p>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-blue-400">Normal (6-15)</h3>
              <p>100% of base XP requirement</p>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-yellow-400">Hard (16-30)</h3>
              <p>130% of base XP requirement</p>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-orange-400">Very Hard (31-50)</h3>
              <p>180% of base XP requirement</p>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-red-400">Extreme (51-62)</h3>
              <p>300% of base XP requirement</p>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-purple-400">Soft Cap (63+)</h3>
              <p>1000% of base XP (nearly impossible)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
