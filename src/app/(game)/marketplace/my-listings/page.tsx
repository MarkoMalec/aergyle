"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { RarityBadge } from "~/utils/ui/rarity-badge"
import { X, Loader2 } from "lucide-react"
import type { MyListingsResponse } from "~/types/marketplace"
import toast from "react-hot-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"

export default function MyListingsPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  
  // Dialog state
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [selectedListing, setSelectedListing] = useState<{ id: number; name: string; price: number } | null>(null)

  // Fetch user's listings
  const { data, isLoading, error } = useQuery<MyListingsResponse>({
    queryKey: ["my-listings", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) {
        throw new Error("Not authenticated")
      }
      
      const response = await fetch(`/api/marketplace/my-listings?userId=${session.user.id}`)
      if (!response.ok) {
        throw new Error("Failed to fetch listings")
      }
      return response.json()
    },
    enabled: !!session?.user?.id,
    staleTime: 10000,
  })

  // Cancel listing mutation
  const cancelMutation = useMutation({
    mutationFn: async (userItemId: number) => {
      if (!session?.user?.id) {
        throw new Error("Not authenticated")
      }

      const response = await fetch("/api/marketplace/cancel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          userItemId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to cancel listing")
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-listings"] })
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      queryClient.invalidateQueries({ queryKey: ["marketplace"] })
      toast.success(`${data.item.itemTemplate.name} returned to your inventory!`)
      setShowCancelDialog(false)
      setSelectedListing(null)
    },
    onError: (error: Error) => {
      toast.error(error.message)
      setShowCancelDialog(false)
      setSelectedListing(null)
    },
  })

  const handleCancelListing = (userItemId: number) => {
    const listing = data?.listings.find((l) => l.id === userItemId)
    if (listing) {
      setSelectedListing({
        id: listing.id,
        name: listing.itemTemplate.name,
        price: listing.listedPrice || 0,
      })
      setShowCancelDialog(true)
    }
  }

  const confirmCancelListing = () => {
    if (selectedListing) {
      cancelMutation.mutate(selectedListing.id)
    }
  }

  if (!session?.user?.id) {
    return (
      <div className="container mx-auto py-10">
        <div className="text-center">
          <p className="text-xl font-semibold">Please sign in to view your listings</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <div className="text-center text-red-500">
          <p className="text-xl font-semibold">Error loading listings</p>
          <p className="text-sm mt-2">{(error as Error).message}</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">My Listings</h1>
        <p className="text-muted-foreground">
          Manage your active marketplace listings
        </p>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Active Listings</p>
            <p className="text-2xl font-bold">{data.count}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold text-yellow-600">{data.totalValue.toLocaleString()} 🪙</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Average Price</p>
            <p className="text-2xl font-bold">
              {data.count > 0 ? Math.round(data.totalValue / data.count).toLocaleString() : "0"} 🪙
            </p>
          </div>
        </div>
      )}

      {/* Listings Table */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-b hover:bg-transparent">
              <TableHead className="font-semibold">Item</TableHead>
              <TableHead className="font-semibold">Rarity</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Price</TableHead>
              <TableHead className="font-semibold">Listed At</TableHead>
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.listings && data.listings.length > 0 ? (
              data.listings.map((listing, idx) => (
                <TableRow key={listing.id} className={idx % 2 === 0 ? "bg-muted/20" : "bg-transparent"}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-md bg-muted overflow-hidden flex-shrink-0">
                        <img
                          src={listing.itemTemplate.sprite || "/placeholder.svg"}
                          alt={listing.itemTemplate.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="font-semibold">{listing.itemTemplate.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RarityBadge rarity={listing.rarity} />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm capitalize">{listing.itemTemplate.equipTo || "Consumable"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-yellow-600">
                      {listing.listedPrice?.toLocaleString() || "0"} 🪙
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {listing.listedAt ? new Date(listing.listedAt).toLocaleDateString() : "Unknown"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleCancelListing(listing.id)}
                      disabled={cancelMutation.isPending}
                      className="gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">
                    You don't have any active listings. Visit your inventory to list items for sale.
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Listing</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the listing for <span className="font-semibold">{selectedListing?.name}</span>?
              The item will be returned to your inventory.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false)
                setSelectedListing(null)
              }}
            >
              No, Keep Listed
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmCancelListing}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Canceling..." : "Yes, Cancel Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
